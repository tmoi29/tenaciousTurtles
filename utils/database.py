import sqlite3, hashlib
from flask import redirect, url_for, request, session, flash


def add_account(username, pass1, pass2):
    db = sqlite3.connect("data/database.db")
    c  = db.cursor()

    #check for duplicate usernames
    saved_users = c.execute('SELECT username FROM accounts WHERE username="{}";'.format(username))
    users = saved_users.fetchall()
    print users 
    if len(users) > 0:
        flash("Whoops! That username is already taken")
        return redirect(url_for('crt_acct'))

    #check if passw is confirmed
    elif pass1 != pass2:
        flash("Whoops! Your passwords don't match")
        return redirect(url_for('crt_acct'))

    #all good! now add entry
    else:
        flash("Yay! Please log in with your new credentials!")
        hash_object = hashlib.sha224(pass1)
        hashed_pass = hash_object.hexdigest()
        c.execute('INSERT INTO accounts VALUES("{}", "{}")'.format(username, hashed_pass))
        db.commit()
        db.close()
        return redirect(url_for('login'))
    

def authenticate(username, password):
    db = sqlite3.connect("data/database.db")
    c  = db.cursor()
    saved_passwords = c.execute('SELECT password FROM accounts WHERE username="{}";'.format(username))
    saved_pass = saved_passwords.fetchall()
    
    print saved_pass
    
    hash_object = hashlib.sha224(password)
    hashed_pass = hash_object.hexdigest()
        
    if len(saved_pass) == 0:
        flash("Whoops! Wrong username :(")
        return redirect(url_for('login'))
    
    for passw in saved_pass:
        if passw[0] == hashed_pass:
            session['username'] = username #add session
            return redirect(url_for('index')) #back to main page
    flash("Whoops! Wrong password :(")
    return redirect(url_for('login'))
    db.close()

def add_review(restaurant, user, rating, reviewTitle, reviewContent):
    db = sqlite3.connect("data/database.db")
    c  = db.cursor()
    c.execute('INSERT INTO reviews VALUES({}, "{}", {}, "{}", "{}" )'.format(restaurant, user, rating, reviewTitle, reviewContent))
    db.commit()
    db.close()

def get_review(restaurant):
    db = sqlite3.connect("data/database.db")
    c  = db.cursor()
    reviews = c.execute("SELECT * FROM reviews WHERE restaurant = {};".format(restaurant))
    for review in reviews:
        print review
        db.close()


    

if (__name__ == "__main__"):
    init = False
    debug = True

    if (init):
        initialize()
        add_account("john smith", "abc123")
        add_account("joe doe", "johnNeedsToChangeHisPassword")
        add_review(1, "john smith", 5, "Nice", "filler text goes here")
        get_review(1)
        
    if (debug):
        print authenticate("john smith", "abc123")
        print authenticate("john smith", "what")
        print authenticate("joe smith", "abc123")
