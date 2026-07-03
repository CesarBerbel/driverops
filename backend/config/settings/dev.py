from .base import *  # noqa: F401,F403

DEBUG = True

# Dev containers talk over plain HTTP, so cookies can't require `Secure`.
AUTH_COOKIE_SECURE = False
