import functools
import sqlite3
import threading
from threading import Thread

from typing import Callable, Dict, Union

from util.types import Function


class Database(object):
    """Database wrapper."""
    
    def __init__(self, path, debug=False):
        # type: (str) -> None
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False)
        # multithreading is only safe when Database.lock() is used
        self.cursor = self.conn.cursor()
        self._lock = threading.Lock()
        self.debug = debug
    
    @staticmethod
    def sanitize(s):
        # type: (str) -> str
        return '"{}"'.format(s.replace("'", "''").replace('"', '""'))
    
    @staticmethod
    def desanitize(s):
        # type: (str) -> str
        return s.replace("''", "'").replace('""', '"').strip('"')
    
    def table_exists(self, table_name):
        # type: (str) -> bool
        query = 'SELECT COUNT(*) FROM sqlite_master WHERE type="table" AND name=?'
        return self.cursor.execute(query, [Database.desanitize(table_name)]).fetchone()[0] > 0
    
    def result_exists(self):
        return self.cursor.fetchone() is not None
    
    def max_rowid(self, table):
        # type: (str) -> int
        query = 'SELECT max(ROWID) FROM {}'.format(table)
        return self.cursor.execute(query).fetchone()[0]
    
    def commit(self):
        # type: () -> None
        self.conn.commit()
    
    def hard_close(self):
        # type: () -> None
        self.conn.close()
    
    def close(self):
        # type: () -> None
        self.commit()
        self.hard_close()
    
    def lock(self):
        # type: () -> None
        self._lock.acquire()
    
    def release_lock(self):
        # type: () -> None
        self._lock.release()
    
    def __enter__(self):
        # type: () -> Database
        self.lock()
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        # type: () -> None
        self.release_lock()
    
    def reset_connection(self):
        self.conn = sqlite3.connect(self.path)
        self.cursor = self.conn.cursor()


class ApplicationDatabaseException(Exception):
    pass


class ApplicationDatabase(object):
    """
    `Database` wrapper for an applications DB-API.
    Intended to be extended for a specific application.
    
    :ivar name: name of database
    :type name: str

    :ivar db: low level database object
    :type db: Database
    
    :ivar schema: SQl DB schema
    :type schema: Dict[str, str]
    
    :ivar exception: Exception class used by DB
    :type exception: type(ApplicationDatabaseException)
    """
    
    def __init__(self, schema, path, exception=ApplicationDatabaseException):
        # type: (Dict[str, str], Union[str, unicode], type(ApplicationDatabaseException)) -> None
        """Create DB with given name and open low level connection through `Database`"""
        self.name = path
        self.schema = schema
        self.exception = exception  # type:
        self.db = Database(path)
        self._create_tables()
    
    def commit(self):
        # type: () -> None
        """Commit DB."""
        self.db.commit()
    
    def hard_close(self):
        # type: () -> None
        """Close DB without committing."""
        self.db.hard_close()
    
    def close(self):
        # type: () -> None
        """Close and commit DB."""
        self.commit()
        self.db.hard_close()
    
    def lock(self):
        # type: () -> None
        """Acquire reentrant lock. By locking, multithreaded to DB is safe."""
        self.db.lock()
    
    def release_lock(self):
        # type: () -> None
        """Release reentrant lock."""
        self.db.release_lock()
    
    def __enter__(self):
        # type: () -> ApplicationDatabase
        """Enter DB (lock) when entering with statement."""
        self.db.__enter__()
        return self
    
    def __exit__(self, exc_type, exc_value, traceback):
        # type: () -> None
        """Exit DB (release lock) after with statement."""
        self.db.__exit__(exc_type, exc_value, traceback)
    
    def _create_tables(self):
        # type: () -> None
        """Create all tables according to `DB_SCHEMA`."""
        map(self.db.cursor.execute, self.schema.viewvalues())
        self.db.commit()
    
    def clear(self):
        # type: () -> None
        """Drop and recreate tables."""
        # noinspection SqlNoDataSourceInspection
        self.db.cursor.executescript(
                ''.join('DROP TABLE {};'.format(table) for table in self.schema))
        self._create_tables()
        self.commit()
    
    def reset_connection(self):
        self.db.reset_connection()
    
    def run_in_background(self, runnable, name=None):
        # type: (Function, str) -> None
        """Run `runnable` in another thread, locking on this DB."""
        if name is None:
            name = runnable.func_name
        else:
            runnable.func_name = name
        
        print(threading.current_thread())
        
        @functools.wraps(runnable)
        def locking_wrapper():
            print('{} is waiting to run in the background'.format(name))
            print(threading.current_thread())
            with self:
                print('{} is running in the background'.format(name))
                runnable()
                print('{} is done running in the background'.format(name))
        
        thread = Thread(target=locking_wrapper)
        thread.background = True
        thread.start()
