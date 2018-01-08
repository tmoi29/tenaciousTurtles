from util.types import Function


def override(method):
    # type: (Function) -> Function
    """Annotates that this method is overriding a super method."""
    return method