import errno
import os

from typing import Union


def mkdir_if_not_exists(dir_path):
    # type: (str) -> None
    try:
        os.makedirs(dir_path)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise


def sanitize_filename(filename):
    # type: (Union[str, unicode]) -> str
    illegal_chars = '/<>:"\'|?*'
    for c in illegal_chars:
        filename = filename.replace(c, '_')
    return filename
