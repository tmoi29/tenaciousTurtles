import sqlite3
import os


def initialize():
    os.remove("data/database.db")
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
    
    c.execute('CREATE TABLE IF NOT EXISTS '
              'favorite('
              'username TEXT, '
              'restaurant INTEGER)')
    
    db.commit()
    db.close()

