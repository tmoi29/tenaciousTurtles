import sqlite3


def initialize():
    db = sqlite3.connect("data/database.db")
    c = db.cursor()
    
    c.execute('CREATE TABLE IF NOT EXISTS '
              'accounts('
              'username TEXT PRIMARY KEY, '
              'password TEXT)')
    
    c.execute('CREATE TABLE IF NOT EXISTS '
              'reviews('
              'restaurant INTEGER, '
              'user TEXT, '
              'rating INTEGER, '
              'reviewTitle TEXT, '
              'reviewContent TEXT)')
    
    db.commit()
    db.close()


initialize()
