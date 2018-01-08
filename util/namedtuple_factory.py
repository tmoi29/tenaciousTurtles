from __future__ import print_function

import collections
from sys import stderr

import typing
from typing import List, Dict, Tuple, Iterable

all_namedtuples = {}  # type: Dict[str, type(typing.NamedTuple)]


# noinspection PyPep8Naming
def NamedTuple(typename, fields):
    # type: (str, Iterable[Tuple[str, type]]) -> type(typing.NamedTuple)
    _type = typing.NamedTuple(typename, fields)
    all_namedtuples[repr(_type)] = _type
    return _type


def namedtuple(typename, field_names, verbose=False, rename=False):
    # type: (str, List[str]) -> type(typing.NamedTuple)
    _type = collections.namedtuple(typename, field_names, verbose, rename)
    all_namedtuples[repr(_type)] = _type
    return _type


def register_namedtuple(_type):
    # type: (type) -> type
    """
    Registers any type as a namedtuple so that it can be JSON serialized.
    
    To be allowed, the type must have an as_tuple() method:
        as_tuple() must return a tuple of the fields that can be passed to
        the _make() class method to reconstruct the object
    and a _make() class method:
        _make() must recreate the object from a tuple of its fields
    """
    error_msg = '{} cannot mimic a namedtuple, it has no {} method'
    
    if not hasattr(_type, 'as_tuple'):
        raise TypeError(error_msg.format(type, 'as_tuple()'))
    elif not hasattr(_type, '_make'):
        raise TypeError(error_msg.format(type, '_make() classmethod'))
    else:
        all_namedtuples[repr(_type)] = _type
        if not hasattr(_type, '_asdict'):
            # must have _asdict attr to b recognized as a namedtuple
            _type._asdict = None
    return _type