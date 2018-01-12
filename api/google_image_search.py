from __future__ import print_function

import requests
from typing import Iterable


USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0'


def get_img_urls(query):
    # type: (str) -> Iterable[str]
    response = requests.get(
            url="https://www.google.com/search?q=" + query + "&tbm=isch",
            headers={
                # needed so that Google returns right page w/ all the URLs
                'User-Agent': USER_AGENT,
            },
    )
    html = response.text  # type: unicode
    field_name = u'"ou":'
    i = 0
    while True:
        i = html.find(field_name, i)
        if i == -1:
            return
        i += len(field_name)
        i += 1
        end = html.find('"', i)
        url = html[i:end]
        yield url.encode('utf-8')
        i = end + 1


if __name__ == '__main__':
    for _url in get_img_urls("Bridgewater Cafe"):
        print(_url)
