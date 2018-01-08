import functools

from typing import Any, Callable, Dict, Tuple, Type, Union

from util.types import Function

T = Type['CtorArgs']  # class type
R = Type['R']  # return type
Extender = Union[Callable[[T, Any], R], callable]
Overrider = Union[Callable[[Callable[[Any], R], T, Any], R], callable]


def extend(klass):
    # type: (Type[T]) -> Function[Extender, None]
    """
    Decorate a method so that it extends a class-like object
    (i.e. also a module), the givne klass.
    """

    def extender(extension_method):
        # type: (Extender) -> None
        setattr(klass, extension_method.func_name, extension_method)
        return None

    return extender


def override(klass):
    # type: (Type[T]) -> Function[Overrider, None]
    """Decorate a method so that it overrides a method already in a class-like object, klass."""

    def overrider(override_method):
        # type: (Overrider) -> None
        func_name = override_method.func_name
        super_method = getattr(klass, func_name)
        
        @functools.wraps(override_method)
        def override_closure(*args, **kwargs):
            # type: (Tuple, Dict) -> R
            return override_method(super_method, *args, **kwargs)

        setattr(klass, func_name, override_closure)
        return None

    return overrider
