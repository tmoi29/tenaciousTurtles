from __future__ import print_function

import hashlib
import sqlite3
import setup_db as setup_db

from flask import flash, session
# noinspection PyCompatibility
from pathlib import Path
from typing import Iterable, List, Tuple

#from util.annotations import deprecated


def add_account(username, password1, password2, setup):
    # type: (unicode, unicode, unicode, bool) -> bool
    """
    Add an account
    Args:
        username (str): username, will not accept duplicates
        password1 (str): first password entered
        password2 (str): second password entered
        setup (bool): ??? FIXME
    Ret:
        If username exists or passwords don't match
            -Redirects you back to page
        Else
            -Adds entry to database
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        
        # check for duplicate usernames
        saved_users = c.execute('SELECT username FROM accounts WHERE username = ?', [username])
        users = saved_users.fetchall()
        print(users)
        if len(users) > 0:
            if not setup:
                flash('Whoops! That username is already taken')
            return False
        
        # check if passw is confirmed
        elif password1 != password2:
            if not setup:
                flash('Whoops! Your passwords don\'t match')
            return False
        
        # all good! now add entry
        else:
            if not setup:
                flash('Yay! You\'ve been logged in!')
            hash_object = hashlib.sha224(password1)
            hashed_pass = hash_object.hexdigest()
            c.execute('INSERT INTO accounts VALUES (?, ?)', [username, hashed_pass])
            db.commit()
            return True


def authenticate(username, password):
    # type: (unicode, unicode) -> bool
    with sqlite3.connect('data/database.db') as db:
        
        c = db.cursor()
        saved_passwords = c.execute(
                'SELECT password FROM accounts WHERE username = ?', [username])
        saved_pass = saved_passwords.fetchall()
        
        print(saved_pass)
        
        hash_object = hashlib.sha224(password)
        hashed_pass = hash_object.hexdigest()
        
        if len(saved_pass) == 0:
            flash('Whoops! Wrong username :(')
            return False
        
        for password in saved_pass:
            if password[0] == hashed_pass:
                session['username'] = username  # add session
                flash("Yay! You\'ve logged in!")
                return True  # back to main page
        flash('Whoops! Wrong password :(')
        return False


def has_review(username, restaurant_id):
    """
    return true if a user has made a review for a restaurant
    else return false
    """
    with sqlite3.connect("data/database.db") as db:
        c = db.cursor()
        review = c.execute('SELECT user FROM reviews WHERE user = ? AND restaurant = ?',
                           [username, restaurant_id])
        if len(review.fetchall()) == 0:
            return False
        return True


def add_review(restaurant, username, rating, review_title, review_content):
    # type: (int, unicode, float, unicode, unicode) -> None
    if not has_review(username, restaurant):
        print('added review:', restaurant, username, rating, review_title, review_content)
        with sqlite3.connect('data/database.db') as db:
            c = db.cursor()
            c.execute(
                    'INSERT INTO reviews VALUES (?, ?, ?, ?, ?)',
                    [restaurant, username, rating, review_title, review_content])
            db.commit()


def remove_review(username, restaurant_id):
    print('deleted review:', username, restaurant_id)
    with sqlite3.connect("data/database.db") as db:
        c = db.cursor()
        c.execute('DELETE FROM reviews WHERE user = ? AND restaurant = ?',
                  [username, restaurant_id])
        db.commit()


def update_review(restaurant, username, rating, review_title, review_content):
    remove_review(username, restaurant)
    add_review(restaurant, username, rating, review_title, review_content)


def get_review(username, restaurant_id):
    with sqlite3.connect("data/database.db") as db:
        c = db.cursor()
        reviews = c.execute('SELECT username FROM reviews WHERE username = ? AND restaurant = ?',
                            [username, restaurant_id])
        return [review[0] for review in reviews]


def get_reviews(restaurant):
    # type: (int) -> List[Tuple[int, unicode, int, unicode, unicode]]
    """
    Gets all reviews of a restaurant
    Arg:
        restaurant (int): ID number of restaurant based on Zomato.
    Ret:
        list of lists: each sublist contains one review,
        items in order of restaurant id(int), username (str), rating (int), review title(str), review content(str).
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        reviews = c.execute(
                'SELECT * FROM reviews WHERE restaurant = ?',
                [restaurant])  # type: Iterable[Tuple[int, unicode, int, unicode, unicode]]
        return [review for review in reviews]


def get_all_review_ratings_raw():
    # type: () -> List[Tuple[int, float]]
    with sqlite3.connect('data/database.db') as db:
        return list(db.cursor().execute('SELECT restaurant, rating FROM reviews'))


#@deprecated
def get_all_review_ratings():
    """
    Gets all ratings of restaurants
    Ret:
        A dictionary with restaurant ids as keys and a list of their ratings
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        r = c.execute(
                'SELECT restaurant, rating FROM reviews')
        ratings = r.fetchall()
        ret = {}
        for entry in ratings:
            if entry[0] in ret:
                ret[int(entry[0])].append(entry[1])
            else:
                ret[int(entry[0])] = []
                ret[int(entry[0])].append(entry[1])
        
        return ret


def add_favorite(username, restaurant_id):
    # type: (unicode, int) -> None
    """
    Adds favorited restaurants for a user
    Arg:
        username (str): username
        restaurant_id  (int): ID number of restaurant based on Zomato
    """
    print('adding favorite: ', username, restaurant_id)
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        c.execute(
                'INSERT INTO favorite VALUES(?, ?)',
                [username, restaurant_id])
        db.commit()


def remove_favorite(username, restaurant_id):
    """
    Removes a favorited restaurant for a user
    Arg:
        username (str): username
        restaurant_id  (int): ID number of restaurant based on Zomato
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        c.execute(
                'DELETE FROM favorite WHERE username = ? AND restaurant = ?',
                [username, restaurant_id])
        db.commit()


def remove_favorite(username, restaurant_id):
    # type: (unicode, int) -> None
    """
    Removes favorited restaurants for a user
    Arg:
        username (str): username
        restaurant_id  (int): ID number of restaurant based on Zomato
    """
    print('removing favorite: ', username, restaurant_id)
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        c.execute(
                'DELETE FROM favorite WHERE username = ? AND restaurant = ?',
                [username, restaurant_id])
        db.commit()


def get_favorite(username):
    # type: (unicode) -> List[int]
    """
    Gets favorited restaurants for a user
    Arg:
        username (str): username
    Ret:
        List of restaurant IDs that user saved
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        query = c.execute('SELECT restaurant FROM favorite WHERE username = ?', [username])
        return [restaurant[0] for restaurant in query]


def in_favorites(username, restaurant_id):
    # type: (unicode, int) -> bool
    """
    Gets favorited restaurants for a user
    Arg:
        username (str): username
        restaurant_ID (int): restaurant ID
    Ret:
        True or false to see whether or not the restaurant is favorited
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        query = c.execute('SELECT restaurant FROM favorite WHERE username = ?  AND restaurant = ?',
                          [username, restaurant_id])
        if len(query.fetchall()) == 0:
            return False
        return True


if __name__ == '__main__':
    path = Path("utils/generate_sample")
    generate_sample = path.is_file()
    
    path = Path("utils/generate_empty")
    init = path.is_file()
    
    debug = False
    filler = \
        'Lorem ipsum dolor sit amet, ' \
        'consectetur adipiscing elit. ' \
        'Cras at mi consequat, sodales sem non, ultricies nisl. ' \
        'Donec consequat dui id eros pulvinar venenatis. ' \
        'Nam suscipit dolor at lacus sollicitudin venenatis. ' \
        'Nam et magna mauris. ' \
        'Sed blandit porta dolor, et viverra eros accumsan in. ' \
        'Sed augue leo, faucibus aliquet nulla quis, pretium porttitor velit. ' \
        'Ut sollicitudin nisi lacus, non ultrices magna tristique in. ' \
        'Cras non metus non velit rhoncus tincidunt. ' \
        'Aliquam condimentum rhoncus ante eget ultricies.'
    
    if init:
        setup_db.initialize()
    
    if generate_sample:
        add_account('john smith', 'abc123', 'abc123', True)
        add_account('joe doe', 'johnNeedsToChangeHisPassword', 'johnNeedsToChangeHisPassword', True)
        add_account('john smith', 'should not happen', 'should not happen', True)
        
        add_favorite("john smith", 1)
        add_favorite("john doe", 11)
        
        print(in_favorites("john smith", 1))
        print(in_favorites("john smith", 11))
        
        remove_favorite("john smith", 1)
        print(in_favorites("john smith", 1))
        
        add_review(1, 'john smith', 5, 'Nice', filler)
        add_review(2, 'john smith', 3, 'pls no', filler)
        add_review(1, 'joe doe', 4, 'ok', filler)
        add_review(17464110, 'joe doe', 2, "meh", filler)
        
        print(get_all_review_ratings())
        print("Samples generated")
    
    if debug:
        # FIXME these calls don't work
        # FIXME since get_favorite() takes the username, not uid
        print(get_favorite(1))
        print(get_favorite(10))
        print(get_favorite(0))
        
        print()
        authenticate('john smith', 'abc123')
        print()
        authenticate('john smith', 'what')
        print()
        authenticate('joe smith', 'abc123')
        print()
        get_reviews(1)
        print()
        get_reviews(2)
