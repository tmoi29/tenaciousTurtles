import math
def round(x):
    p = x % math.floor(x)
    if p == 0:
        return x
    elif p >= 0.5:
        return math.floor(x) + 1
    else:
        return math.floor(x)


print round(2.5)
print round(2.0)
print round(2.1)
print round(2.7)


def make_stars(x):
    x = round(x)
    ret_str = ""
    if (x == 0) or (x == "N/A"):
        return "N/A"
    elif x >= 5:
        for i in range(5):
            ret_str += " <i class='glyphicon glyphicon-star'></i>"
    else:
        for i in range(x):
            ret_str += "<i class='glyphicon glyphicon-star'></i>"
        for i in range(5-x):
            ret_str += "<i class='glyphicon glyphicon-star-empty'></i>"
    return ret_str
    
print("3 stars: \n \n \n")
print(make_stars(3))
