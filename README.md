![Welp](static/img/logo.png)
# tenaciousTurtles

## Features

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

#### Google

Go to the [Google Geocoding get API key page](https://developers.google.com/maps/documentation/geocoding/get-api-key)

Request an API key

Copy the API key from the confirmation screen

Save both keys in `.secret_key.txt` in the same directory as app.py

### 3. Prepare for launch

#### Virtualenv

We recommend you use an virtual environment to install dependencies for this site.

[To install virtualenv](https://virtualenv.pypa.io/en/stable/installation/)

[To create an virtualevn](https://virtualenv.pypa.io/en/stable/reference/#virtualenv-command)

To activate virtualenv in a Unix-based system:

`$ . <name of virtualenv>/bin/activate`

#### Install dependencies

With an activated virtualenv:

`pip install -r ../tenaciousTurtles/requirements.txt`

### 4. Launch

In the repository for this site:

`python app.py`

In a browser, navigate to:

`localhost:5000`
