import urllib2, json

base="https://freegeoip.net/json"


def access_url():
    data = urllib2.urlopen(base)
    d = json.loads(data.read())
    return d


