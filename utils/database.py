from __future__ import print_function
from pathlib import Path

import hashlib
import sqlite3

from flask import flash, session
# from utils.setup_db import initialize
from typing import Iterable, List, Tuple


def add_account(username, password1, password2):
    # type: (unicode, unicode, unicode) -> bool
    """
    Add an account
    Args:
        username (str): username, will not accept duplicates
        password1 (str): first password entered
        password2 (str): second password entered
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
            flash('Whoops! That username is already taken')
            return False
        
        # check if passw is confirmed
        elif password1 != password2:
            flash('Whoops! Your passwords don\'t match')
            return False
        
        # all good! now add entry
        else:
            flash('Yay! Please log in with your new credentials!')
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
                return True  # back to main page
        flash('Whoops! Wrong password :(')
        return False


def add_review(restaurant, user, rating, review_title, review_content):
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        c.execute(
                'INSERT INTO reviews VALUES (?, ?, ?, ?, ?)',
                [restaurant, user, rating, review_title, review_content])
        db.commit()


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


def add_favorite(username, restaurant_id):
    # type: (int, int) -> None
    """
    Adds favorited restaurants for a user
    Arg:
        username (str): username
        restaurant_id  (int): ID number of restaurant based on Zomato
    """
    with sqlite3.connect('data/database.db') as db:
        c = db.cursor()
        c.execute(
                'INSERT INTO favorite VALUES(?, ?)',
                [username, restaurant_id])
        db.commit()


def get_favorite(username):
    # type: (int) -> List[int]
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


if __name__ == '__main__':
    file = Path("generate_sample")
    generate_sample = file.is_file()

    file = Path("generate_empty")
    init = file.is_file()
    
    debug           = False
    filler = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras at mi consequat, sodales sem non, ultricies nisl. Donec consequat dui id eros pulvinar venenatis. Nam suscipit dolor at lacus sollicitudin venenatis. Nam et magna mauris. Sed blandit porta dolor, et viverra eros accumsan in. Sed augue leo, faucibus aliquet nulla quis, pretium porttitor velit. Ut sollicitudin nisi lacus, non ultrices magna tristique in. Cras non metus non velit rhoncus tincidunt. Aliquam condimentum rhoncus ante eget ultricies.'
    
    if init or generate_sample:
        add_favorite(1, 2)
        add_favorite(10, 11)
        add_favorite(1, 15)

    if generate_sample:
        print()
        add_account('john smith', 'abc123', 'abc123')
        print()
        add_account('joe doe', 'johnNeedsToChangeHisPassword', 'johnNeedsToChangeHisPassword')
        print()
        add_account('john smith', 'should not happen', 'should not happen')
        add_review(1, 'john smith', 5, 'Nice', filler)
        add_review(2, 'john smith', 3, 'pls no', filler)
        add_review(1, 'joe doe', 4, 'ok', filler)
        
    if debug:
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
        get_review(1)
        print()
        get_review(2)
