from flask import Response
from typing import Callable, Union

Precondition = Union[Callable[[], bool], callable]
Route = Union[Callable[[], Response], callable]
Router = Callable[[Route], Route]