(function welp() {
    
    /**
     * Export a variable amount of named functions to another scope.
     *
     * @param scope the scope to export the var args functions to
     */
    const exportTo = function(scope) {
        [...arguments].slice(1)
            .filter(e => e instanceof Function)
            .forEach(func => {
                scope[func.name] = func;
            });
    };
    
    (function locationModule(_outer) {
        
        const outer = _outer;
        
        const hasGps = "geolocation" in navigator;
        
        const newCoords = function(latitude, longitude) {
            return {
                latitude: latitude,
                longitude: longitude
            };
        };
        
        const sendCoords = function(coords) {
            $.ajax({
                url: "/location", // TODO
                type: "POST",
                data: JSON.stringify(coords)
            });
        };
        
        let lastLocation = null;
        let useGps = true;
        
        const processLocation = function(location) {
            const coords = newCoords(location.latitude, location.longitude);
            lastLocation = coords;
            sendCoords(coords);
            return coords;
        };
        
        const getGeolocation = function(onError) {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, error => {
                    resolve(onError());
                });
            })
                .then(position => processLocation(position.coords));
        };
        
        const getIpLocation = function() {
            return new Promise((resolve, reject) => {
                $.getJSON("//freegeoip.net/json/?callback=?", resolve);
            })
                .then(processLocation);
        };
        
        const getLocation = function() {
            return lastLocation
                ? Promise.resolve(lastLocation)
                : useGps && hasGps
                    ? getGeolocation(getIpLocation)
                    : getIpLocation();
        };
        
        getLocation.invalidate = function() {
            lastLocation = null;
        };
        
        getLocation.useGps = function(use = true) {
            useGps = use;
        };
        
        getLocation.dontUseGps = function() {
            this.useGps(false);
        };
        
        outer.getLocation = getLocation;
        
    })(this);
    
    (function zomatoModule(_outer, _apiKey) {
        
        const outer = _outer;
        
        const apiKey = _apiKey;
        
        const getZomato = function(route, query) {
            const baseUrl = "https://developers.zomato.com/api/v2.1/";
            const url = baseUrl + route + "?"
                + Object.entries(query)
                    .filter(e => e[1]) // filter out false values
                    .map(e => e[0] + "=" + e[1])
                    .join("&");
            return new Promise((resolve, reject) => {
                $.getJSON(url, {
                    // TODO check data
                    method: "GET",
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "user-key": apiKey,
                    },
                }, resolve);
            });
        };
        
        const getRestaurant = function(restaurantId) {
            return getZomato("restaurant", {
                res_id: restaurantId,
            });
        };
        
        const getReviewsPremium = function(restaurantId, start, count) {
            return getZomato("reviews", {
                res_id: restaurantId,
                start: start,
                count: count,
            });
        };
        
        const getReviews = function(restaurantId) {
            // only 0-5 reviews are allowed w/ Basic Plan
            return getReviewsPremium(restaurantId, 0, 5);
        };
        
        const search = function( //
            entityId, entityType, query, start, count,
            coords, radius,
            cuisines, establishmentType,
            collectionId, category,
            sortBy, ascending = true) {
            
            if (count > 20) {
                throw new Error("count <= 20 but is " + count);
            }
            if (start + count > 100) {
                throw new Error("start + count <= 100 but is " + start + count);
            }
            
            return getZomato("search", {
                entity_id: entityId,
                entity_type: entityType,
                q: query,
                start: start,
                count: count,
                lat: coords.latitude,
                lon: coords.longitude,
                radius: radius,
                cuisines: cuisines,
                establishment_type: establishmentType,
                collection_id: collectionId,
                category: category,
                sort: sortBy,
                order: ascending ? "asc" : "desc",
            });
        };
        
        const searchRestaurantsRaw = function(start, count, radius, getLocationFunc) {
            // Promises can resolve nested Promises
            return getLocationFunc()
                .then(coords =>
                    search(
                        null, "zone", null, start, count,
                        coords, radius,
                        null, null,
                        null, null,
                        "real_distance", true));
        };
        
        const searchRestaurants = function(start, count, radius, getLocationFunc) {
            return searchRestaurantsRaw(start, count, radius, getLocationFunc)
                .then(response => response.restaurants);
        };
        
        /**
         * Create a new Restaurants object with a getLocationPromiseFunc
         * or the default getLocation.
         *
         * @param {() => Promise<Location>} getLocationPromiseFunc
         *      a function that returns a promise of coordinates
         *      if null, defaults to getLocation,
         *      which uses geolocation if able, or else IP address
         * @return a new Restaurants object
         */
        const newRestaurants = function(getLocationPromiseFunc) {
            
            const getLocationFunc = getLocationPromiseFunc || getLocation;
            
            const count = 20; // set by Zomato
            const maxStart = 100; // set by Zomato
            const radiusStep = 1000; // 1 km, I chose this
            const maxFails = 10; // number of times 0 restaurants can be found before terminating the restaurant stream
            
            let numFails = 0;
            
            let restaurantNum = 0;
            
            let radius = radiusStep;
            let start = 0;
            let restaurantStack = [];
            let lastPromise = null;
            
            const parentLastChildHasNoMoreRestaurants = function(parent) {
                const last = parent.lastChild;
                return last && last.hasOwnProperty("hasMoreRestaurants") && !last.hasMoreRestaurants;
            };
            
            return {
                
                /**
                 * Get the next promise of a restaurant.
                 *
                 * A lazy, infinite generator of restaurants.
                 *
                 * It will keep fetching more restaurants at a certain radius
                 * until the limit (100) is reached,
                 * or there are no more restaurants left,
                 * and then it will continue to expand the radius
                 * and keep returning more restaurant promises.
                 *
                 * @return {Promise} a Promise<RestaurantL3> returned by Zomato
                 */
                next: function() {
                    if (numFails > maxFails) {
                        return Promise.reject(new Error("0 restaurants found " + numFails + " in a row"));
                    }
                    
                    restaurantNum++;
                    return new Promise((resolve, reject) => {
                        if (restaurantStack.length > 0) {
                            resolve(restaurantStack.pop());
                            return;
                        }
                        if (lastPromise) {
                            // use result of yet to be resolved lastPromise
                            lastPromise.then(() => resolve(restaurantStack.pop()));
                            return;
                        }
                        lastPromise = searchRestaurants(start, count, radius)
                            .then(restaurants => {
                                if (start >= maxStart || restaurants.length === 0) {
                                    if (restaurants.length === 0) {
                                        numFails++;
                                    }
                                    // advance outer "loop"
                                    start = 0;
                                    radius += radiusStep;
                                    // recursively call to "iterate"
                                    restaurantNum--; // don't count twice
                                    lastPromise = null;
                                    this.next().then(restaurant => resolve(restaurant));
                                    return;
                                }
                                // advance inner "loop"
                                numFails = 0; // reset
                                start += count;
                                // reverse so can treat as stack
                                restaurantStack = restaurants.slice().reverse();
                                // invalidate lastPromise b/c this one is done
                                lastPromise = null;
                                resolve(restaurantStack.pop());
                            })
                            .catch(error => reject(error));
                    });
                },
                
                currentRestaurantNum: function() {
                    return restaurantNum;
                },
                
                hasMore: function() {
                    return numFails <= maxFails;
                },
                
                addNextTo: function(parent, restaurantDivToFunc) {
                    if (!restaurantDivToFunc) {
                        throw new Error("restaurantDivToFunc not supplied");
                    }
                    const restaurantToDiv = restaurantDivToFunc;
                    
                    if (!this.hasMore()) {
                        return Promise.resolve(false);
                    }
                    
                    if (parentLastChildHasNoMoreRestaurants(parent)) {
                        return Promise.resolve(false);
                    }
                    
                    const addRestaurantDivToParent = function(parent, restaurant) {
                        const div = document.createElement("div");
                        div.hasMoreRestaurants = true;
                        parent.appendTo(div);
                        restaurantToDiv(div, restaurant);
                    };
                    
                    return new Promise((resolve, reject) => {
                        this.next()
                            .then(restaurant => {
                                addRestaurantDivToParent(parent, restaurant);
                                resolve(true);
                            })
                            .catch(error => {
                                console.log(error);
                                if (!parentLastChildHasNoMoreRestaurants(parent)) {
                                    addRestaurantDivToParent(parent, null);
                                }
                                resolve(false);
                                reject(error);
                            });
                    });
                },
                
            };
            
        };
        
        const exampleRestaurantsUsage = function() {
            const restaurants = newRestaurants();
            // either
            const element = $("#id");
            restaurants.next()
                .then(restaurant => element.innerText = JSON.stringify(restaurant))
                .catch(error => element.innerText = "No more restaurants found");
            // or
            restaurants.addNextTo(document.body);
        };
        
        outer.getRestaurant = getRestaurant;
        outer.getReviews = getReviews;
        outer.newRestaurants = newRestaurants;
        
    })(this);
    
    (function mainPage(_outer) {
        
        const zipCodeFieldId = ""; // TODO
        const zipCodeEnterButtonId = ""; // TODO
        const locateButtonId = ""; // TODO
        const moreRestaurantsButtonId = ""; // TODO
        const restaurantListId = ""; // TODO
        
        const zipCodeField = $(zipCodeFieldId);
        const zipCodeEnterButton = $(zipCodeEnterButtonId);
        const locateButton = $(locateButtonId);
        const moreRestaurantsButton = $(moreRestaurantsButtonId);
        const restaurantList = $(restaurantListId);
        
        let useZipCode = false;
        let lastLocation = null;
        
        zipCodeEnterButton.addEventListener("click", event => {
            useZipCode = true;
            getLocation.dontUseGps();
        });
        
        locateButton.addEventListener("click", event => {
            useZipCode = false;
            getLocation.useGps();
        });
        
        const restaurants = newRestaurants(() => {
            return new Promise((resolve, reject) => {
                if (useZipCode) {
                    if (lastLocation) {
                        resolve(lastLocation);
                        return;
                    }
                    const zipCodeText = zipCodeField.text();
                    if (zipCodeText && zipCodeText.length === 5) {
                        // TODO need to use another API to convert zipCode to lat, long
                        return;
                    }
                }
                return getLocation();
            });
        });
    
        /**
         * Add Zomato restaurant data to a div.
         *
         * @param {HTMLDivElement} div div restaurant data will be added to
         * @param {RestaurantL3} restaurant RestaurantL3 (from Zomato) restaurant data
         */
        const restaurantToDiv = function(div, restaurant) {
            // TODO
        };
        
        moreRestaurantsButton.addEventListener("click", event => {
            restaurants.addNextTo(restaurantList, restaurantToDiv);
        });
        
    })(this);
    
})();