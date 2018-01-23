import json
import os

from flask import Flask, Response, flash, render_template, request, session
from typing import Any

from api import google_image_search
from util.flask.flask_utils import form_contains, post_only, preconditions, query_contains, \
    reroute_to, session_contains
from util.flask.flask_utils_types import Route, Router
from util.flask.template_context import add_template_context, context
from utils import database

api_keys_json = open('api/secrets.json').read()
context['api_keys_json'] = api_keys_json

app = Flask(__name__, static_url_path='')

UID_KEY = 'uid'

is_logged_in = session_contains(UID_KEY)
is_logged_in.func_name = 'is_logged_in'
context[is_logged_in.func_name] = is_logged_in

is_not_logged_in = ~is_logged_in
is_not_logged_in.func_name = 'is_not_logged_in'
context[is_not_logged_in.func_name] = is_not_logged_in

context['database'] = database
context['json'] = json
context['session'] = session
context['UID_KEY'] = UID_KEY


@app.reroute_from('/')
@app.route('/index')
def index():
    # type: () -> Response
    return render_template('index.html')


@app.route('/login')
def login_page():
    # type: () -> Response
    if is_logged_in():
        return reroute_to(index)
    return render_template('login.html')


logged_in = preconditions(login_page, is_logged_in)  # type: Router
not_logged_in = preconditions(index, is_not_logged_in)  # type: Router


@app.route('/login_auth', methods=['GET', 'POST'])
@not_logged_in
@preconditions(login_page, post_only, form_contains('username', 'password'))
def login():
    # type: () -> Response
    form = request.form
    username = form['username']
    if not database.authenticate(username, form['password']):
        return reroute_to(login_page)
    session[UID_KEY] = username
    return reroute_to(profile)


@app.route('/create_account')
@not_logged_in
def create_account_page():
    # type: () -> Response
    return render_template('create_account.html')


@app.route('/create_account_auth', methods=['GET', 'POST'])
@not_logged_in
@preconditions(create_account_page, post_only,
               form_contains('username', 'password1', 'password2'))
def create_account():
    # type: () -> Response
    form = request.form
    username = form['username']
    if not database.add_account(username, form['password1'], form['password2'], False):
        return reroute_to(create_account_page)
    session[UID_KEY] = username
    return reroute_to(profile)


@app.route('/logout')
@logged_in
def logout():
    # type: () -> Response
    del session[UID_KEY]
    flash('Yay! Successfully logged out!')
    return reroute_to(index)


def as_json_response(obj):
    # type: (Any) -> Response
    return Response(status=200, mimetype='application/json', response=json.dumps(obj))


@app.route('/google_image_search', methods=['GET', 'POST'])
def google_image_search_urls():
    # type: () -> Response
    arg_name = 'query'
    if arg_name not in request.args and arg_name not in request.form:
        return Response(status=400, mimetype='application/json')
    query = request.args.get(arg_name) or request.form.get(arg_name)
    img_urls = google_image_search.get_img_urls(query)
    return as_json_response(img_urls)


@app.route('/all_review_ratings_raw', methods=['GET', 'POST'])
def all_review_ratings_raw():
    # type: () -> Response
    return as_json_response(database.get_all_review_ratings_raw())


@app.route('/empty', methods=['GET', 'POST'])
def empty():
    # type: () -> Response
    return Response(status=204, response='')  # HTTP 204 is No Content


@app.route('/restaurant_info')
@preconditions(index, query_contains('restaurant_id'))
def restaurant_info():
    # type: () -> Response
    restaurant_id = int(request.args['restaurant_id'])
    db_reviews = database.get_reviews(restaurant_id)
    name = request.args['name']
    welp_reviews = [{
        'rating': rating,
        'rating_text': review_title,
        'review_text': review_content,
        'user': {
            'name': username
        },
    } for restaurant_id, username, rating, review_title, review_content in db_reviews]
    
    if is_logged_in():
        username = session[UID_KEY]
        favorited = database.in_favorites(username, restaurant_id)
    else:
        favorited = None
    
    return render_template(
            'restaurant_info.html',
            restaurant_id=restaurant_id,
            user_reviews=db_reviews,
            welp_reviews=welp_reviews,
            favorited=favorited,
            name=name,
    )


@app.route('/profile')
@logged_in
def profile():
    username = session[UID_KEY]
    restaurants = database.get_favorite(username)
    return render_template('profile.html', restaurant_ids=restaurants)


def make_favorite_route(add, db_function):
    # type: (bool) -> Route
    
    @preconditions(empty, post_only, is_logged_in, form_contains('restaurant_id'))
    def favorite():
        # type: () -> str
        username = session[UID_KEY]
        restaurant_id = int(request.form['restaurant_id'])
        db_function(username, restaurant_id)
        # flash('Yay! You {} this restaurant to your favorites list!'
        #       .format('added' if add else 'removed'))
        return 'OK'
    
    favorite.func_name = ('add' if add else 'remove') + '_favorite'
    favorite = app.route('/' + favorite.func_name, methods=['GET', 'POST'])(favorite)
    return favorite


add_favorite = make_favorite_route(True, database.add_favorite)
remove_favorite = make_favorite_route(False, database.remove_favorite)


@app.route('/add_review', methods=['GET', 'POST'])
@preconditions(empty, post_only, is_logged_in,
               form_contains('restaurant_id', 'rating', 'review_title', 'review_content'))
def add_review():
    # type: () -> str
    form = request.form
    username = session[UID_KEY]
    restaurant_id = int(form['restaurant_id'])
    rating = float(form['rating'])
    review_title = form['review_title']
    review_content = form['review_content']
    database.add_review(restaurant_id, username, rating, review_title, review_content)
    return 'OK'


@app.route('/delete_review', methods=['GET', 'POST'])
@preconditions(empty, is_logged_in,
               form_contains('restaurant_id'))
def delete_review():
    # type: () -> str
    form = request.form
    username = session[UID_KEY]
    restaurant_id = int(form['restaurant_id'])
    database.remove_review(username, restaurant_id)
    return "OK"


if __name__ == '__main__':
    app.secret_key = os.urandom(32)
    add_template_context(app)
    app.run(debug=True)
