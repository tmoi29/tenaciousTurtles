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

def add_review(restaurant, user, rating, reviewTitle, reviewContent):
    db = sqlite3.connect("database.db")
    c  = db.cursor()

    c.execute('INSERT INTO reviews VALUES({}, "{}", {}, "{}", "{}" )'.format(restaurant, user, rating, reviewTitle, reviewContent))
    db.commit()
    db.close()

def get_review(restaurant):
    db = sqlite3.connect("database.db")
    c  = db.cursor()

    c.execute("SELECT * FROM reviews WHERE restaurant = {}".format(restaurant))
    db.commit()
    db.close()
    
    

if (__name__ == "__main__"):
    init = True
    debug = True

    if (init):
        initialize()
        
    if (debug):
        add_account("john smith", "abc123")
        add_account("joe doe", "johnNeedsToChangeHisPassword")
