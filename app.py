import json
import os

from flask import Flask, Response, render_template, request, session

from util.flask.flask_utils import form_contains, post_only, preconditions, reroute_to, \
    session_contains
from util.flask.flask_utils_types import Router
from util.flask.template_context import add_template_context, context
from utils import database

zomato_api_key = json.loads(open('api/secrets.json').read())['zomato']['key']

app = Flask(__name__, static_url_path='')

UID_KEY = 'uid'

is_logged_in = session_contains(UID_KEY)
is_logged_in.func_name = 'is_logged_in'
context[is_logged_in.func_name] = is_logged_in

is_not_logged_in = ~is_logged_in
is_not_logged_in.func_name = 'is_not_logged_in'
context[is_not_logged_in.func_name] = is_not_logged_in


@app.reroute_from('/')
@app.route('/index')
def index():
    # type: () -> Response
    return render_template('index.html', logged_in=is_logged_in(), zomato_api_key=zomato_api_key)


@app.route('/login')
def login_page():
    # type: () -> Response
    if is_logged_in():
        return reroute_to(index)
    return render_template('login.html')


logged_in = preconditions(login_page, is_logged_in)  # type: Router
not_logged_in = preconditions(index, is_not_logged_in)  # type: Router


@app.route('/login_auth', methods=['get', 'post'])
@not_logged_in
@preconditions(login_page, post_only, form_contains('username', 'password'))
def login():
    # type: () -> Response
    session[UID_KEY] = True  # TODO
    form = request.form
    if not database.authenticate(form['username'], form['password']):
        return reroute_to(login_page)
    return reroute_to(index)


@app.route('/create_account')
@not_logged_in
def create_account_page():
    # type: () -> Response
    return render_template('create_account.html')


@app.route('/create_account_auth', methods=['get', 'post'])
@not_logged_in
@preconditions(create_account_page, post_only,
               form_contains('username', 'password1', 'password2'))
def create_account():
    # type: () -> Response
    form = request.form
    if not database.add_account(form['username'], form['password1'], form['password2']):
        return reroute_to(create_account_page)
    return reroute_to(login)


@app.route('/logout')
@logged_in
def logout():
    # type: () -> Response
    del session[UID_KEY]
    return reroute_to(index)


@app.route('/restaurant_info')
@preconditions(index, form_contains('restaurant_id'))
def info():
    # type: () -> Response
    restaurant_id = request.form['restaurant_id']
    db_reviews = database.get_review(restaurant_id)
    # TODO lookup reviews for restaurant in DB
    return render_template('restaurant_info.html', user_reviews=db_reviews, json=json)  # FIXME


if __name__ == '__main__':
    app.secret_key = os.urandom(32)
    add_template_context(app)
    app.run(debug=True)
