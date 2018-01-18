![Welp](static/img/logo.png)
# Tenacious Turtles
#### Made by Karina Ionkina, Leo Liu, Tiffany Moi and Khyber Sen
## Features

Welp is a web app designed to provide users with information about nearby restaurants. The user may provide his/her location by providing a zip code or allowing Welp to access GPS, IP, and other network information.

A user may log in to leave reviews for restaurants in addition to the existing reviews provided by Zomato.

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

Save both keys in `.secrets.json` in /api, according to the format of `secrets_template.json`

### 3. Prepare for launch

#### Virtualenv

We recommend you use an virtual environment to install dependencies for this site.

[To install virtualenv](https://virtualenv.pypa.io/en/stable/installation/)

[To create an virtualenv](https://virtualenv.pypa.io/en/stable/reference/#virtualenv-command)

To activate virtualenv in a Unix-based system:

`$ . <name of virtualenv>/bin/activate`

#### Install dependencies

With an activated virtualenv:

`pip install -r ../tenaciousTurtles/requirements.txt`

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
