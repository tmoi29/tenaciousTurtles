from flask import Flask, url_for, render_template, redirect, url_for, request, session, flash
from utils import database, freegeoip
import os

app = Flask(__name__, static_url_path='')

#for sessions
app.secret_key = os.urandom(32)

@app.route('/')
def index():
    loggedIn = False
    if session.get('username'):
        loggedIn = True
    return render_template("index.html", login = loggedIn)

@app.route('/login', methods=['GET', 'POST'])

def login():
    # if user already logged in, redirect to homepage
    if session.get('username'):
        flash("Whoops! You're already signed in.")
        return redirect(url_for('index')) #something
    
    # user entered login form
    elif request.form.get('login'):
        user = request.form.get('user')
        passw = request.form.get('passw')
        return database.authenticate(user,passw)
    
    # user didn't enter form
    else:
        return render_template('login.html', login = False)


@app.route('/crt_acct', methods=['GET', 'POST'])
def crt_acct():
    # if user already logged in, redirect to homepage(base.html)
    if session.get('username'):
        flash("Whoops! You're already signed in.")
        return redirect(url_for('index')) #something
    
    # user entered create account form
    elif request.form.get('crt_acct'):
        user = request.form.get('user')
        print user
        passw1 = request.form.get('pass1')
        passw2 = request.form.get('pass2')
        return database.add_account(user,passw1,passw2)
    
    # user didn't enter form
    else:
        return render_template("create_acct.html", login = False)
    
#logout
@app.route('/logout', methods=['GET', 'POST'])
def logout():
    if not session.get('username'):
        flash("Yikes! You're not logged in")
        return redirect(url_for('login'))
    else:
        flash("Yay! You've successfully logged out")
        session.pop('username')
        return redirect(url_for('login'))


if __name__ == '__main__':
    app.run(debug=True)
