![Welp](static/img/logo.png)
# Tenacious Turtles
#### Made by Karina Ionkina, Leo Liu, Tiffany Moi and Khyber Sen

## What is Welp

Welp is a web app designed to provide users with information about nearby restaurants. Unlike Yelp, we are dedicated solely to recommendations on food.

## Features

The user may provide his/her location by providing a zip code or allowing Welp to access GPS, IP, and other network information in order for us to provide information on restaurants near you. We provide information such as the restaurant's address, menu, type of cuisine, ratings, and reviews.
A user may also log in to leave reviews for restaurants in addition to the existing reviews provided by Zomato, as well as save restaurants as Favorites. 


## Launch Instructions

### 1. Clone this repository

#### ssh:

`git clone git@github.com:tmoi29/tenaciousTurtles.git`

#### https:

`git clone https://github.com/tmoi29/tenaciousTurtles.git`

### 2. Procure API keys

#### Zomato:

Go to the [Zomato API page](https://developers.zomato.com/api)

Request an API key

Get said key in e-mail

#### Google:

Go to the [Google Geocoding get API key page](https://developers.google.com/maps/documentation/geocoding/get-api-key)

Request an API key

Copy the API key from the confirmation screen

Save both keys in `secrets.json` in `/api`, according to the format of `secrets_template.json`

### 3. Prepare for launch

#### Virtualenv

We recommend you use a virtual environment to install dependencies for this site.

[To install virtualenv](https://virtualenv.pypa.io/en/stable/installation/)

[To create a virtualenv](https://virtualenv.pypa.io/en/stable/reference/#virtualenv-command)

To activate virtualenv in a Unix-based system:

`$ . <name of virtualenv>/bin/activate`

#### Install dependencies

With an activated virtualenv:

`pip install -r requirements.txt`

#### Sample database

If you want a sample database containing a few premade accounts and reviews:

   From the root of the repo:

   ```
   touch utils/generate_sample
   python utils/database.py
   rm utils/generate_sample
   ```

#### Reset database

If you want a blank database ready for usage:

   From the root of the repo:
   ```
   touch utils/generate_empty
   python utils/database.py
   rm utils/generate_empty
   ```


### 4. Launch

In the repository for this site:

`python app.py`

In a browser, navigate to:

`localhost:5000`
