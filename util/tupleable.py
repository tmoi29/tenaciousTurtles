from typing import Tuple


class Tupleable(object):
    
    def as_tuple(self):
        # type: () -> Tuple
        pass
    
    def __repr__(self):
        # type: () -> str
        fields = self.as_tuple()
        fmt = '{}({})'.format(type(self).__name__, ('%s, ' * len(fields))[:-2])
        return fmt % fields
    
    def __eq__(self, other):
        if type(self) != type(other):
            return False
        return self.as_tuple() == other.as_tuple()
    
    def __ne__(self, other):
        return not (self == other)
    
    def __hash__(self):
        return hash(self.as_tuple())