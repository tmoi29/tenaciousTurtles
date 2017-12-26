from flask import Flask, url_for, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template("index.html", login = False)

@app.route('/login')
def login():
    return render_template("login.html", login = False)

@app.route('/create_account')
def c_a():
    return render_template("create_account.html", login = False)


if __name__ == '__main__':
    app.run(debug=True)
