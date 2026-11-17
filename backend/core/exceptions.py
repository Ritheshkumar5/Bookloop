from rest_framework.exceptions import APIException


class BadRequest(APIException):
    status_code = 400
    default_detail = "The request could not be completed."
    default_code = "bad_request"


class Conflict(APIException):
    status_code = 409
    default_detail = "This request conflicts with the current resource state."
    default_code = "conflict"
