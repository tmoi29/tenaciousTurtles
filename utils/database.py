import sqlite3

def initialize():
    db = sqlite3.connect("database.db")
    c  = db.cursor()
    
    c.execute("CREATE TABLE accounts(username STRING PRIMARY KEY, password STRING)")
    c.execute("CREATE TABLE reviews(restaurant INTEGER, user STRING, rating INTEGER, reviewTitle STRING, reviewContent STRING)")
    db.commit()
    db.close()


def add_account(username, password):
    db = sqlite3.connect("database.db")
    c  = db.cursor()
    
    #add error handling for duplicate username
    
    c.execute('INSERT INTO accounts VALUES("{}", "{}")'.format(username, password))
    db.commit()
    db.close()

def authenticate(username, password):
    db = sqlite3.connect("database.db")
    c  = db.cursor()
    saved_passwords = c.execute('SELECT password FROM accounts WHERE username="{}";'.format(username))
    ret = False
    for saved_password in saved_passwords:
        ret = saved_password[0] == password
    db.close()
    return ret

def add_review(restaurant, user, rating, reviewTitle, reviewContent):
    db = sqlite3.connect("database.db")
    c  = db.cursor()
    c.execute('INSERT INTO reviews VALUES({}, "{}", {}, "{}", "{}" )'.format(restaurant, user, rating, reviewTitle, reviewContent))
    db.commit()
    db.close()

def get_review(restaurant):
    db = sqlite3.connect("database.db")
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
