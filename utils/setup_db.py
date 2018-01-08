import sqlite3

def initialize():
    db = sqlite3.connect("data/database.db")
    c  = db.cursor()
    
    c.execute("CREATE TABLE IF NOT EXISTS accounts(username STRING PRIMARY KEY, password STRING)")
    c.execute("CREATE TABLE IF NOT EXISTS reviews(restaurant INTEGER, user STRING, rating INTEGER, reviewTitle STRING, reviewContent STRING)")
    db.commit()
    db.close()

initialize()
