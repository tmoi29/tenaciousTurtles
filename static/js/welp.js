(function welp(_outer) {
    "use strict";
    
    const outer = _outer || {};
    
    Array.prototype.addAll = function(elements) {
        this.push.apply(this, elements);
    };
    
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
    
    const Range = function(start, end) {
        this.forEach = function(func) {
            for (let i = start; i < end; i++) {
                func(i);
            }
        };
        this.map = function(mapper) {
            const a = new Array(end - start);
            this.forEach(i => a[i] = mapper(i, a));
            return a;
        };
    };
    
    const sleep = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };
    
    const LocationModule = function() {
        
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
        
        return {
            getLocation: getLocation,
        };
        
    };
    
    const ZomatoModule = function(LocationModule, _apiKey) {
        
        const apiKey = _apiKey || prompt("Enter Zomato API key:");
        
        const getZomato = function(route, query) {
            const baseUrl = "https://developers.zomato.com/api/v2.1/";
            const url = baseUrl + route + "?"
                + Object.entries(query)
                    .filter(e => e[1]) // filter out false values
                    .map(e => e[0] + "=" + e[1])
                    .join("&");
            console.log(url);
            return fetch(url, {
                method: "GET",
                headers: {
                    "user-key": apiKey,
                },
            })
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    window.data = data;
                    return data;
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
                throw new Error("count must <= 20 but is " + count);
            }
            if (start + count > 100) {
                throw new Error("start + count must <= 100 but is " + start + count);
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
                .then(coords => {
                    console.log(coords);
                    return search(
                        null, "zone", null, start, count,
                        coords, radius,
                        null, null,
                        null, null,
                        "real_distance", true);
                });
        };
        
        const searchRestaurants = function(start, count, radius, getLocationFunc) {
            return searchRestaurantsRaw(start, count, radius, getLocationFunc)
                .then(response => {
                    const restaurants = response.restaurants.map(restaurant => restaurant.restaurant);
                    for (let i = 0; i < restaurants.length; i++) {
                        restaurants[i].originalNum = start + i;
                    }
                    return restaurants;
                });
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
            
            const getLocationFunc = getLocationPromiseFunc || LocationModule.getLocation;
            
            const count = 20; // set by Zomato
            const maxStart = 100; // set by Zomato
            const radiusStep = 100000; // 100 km, I chose this
            const maxFails = 10; // number of times 0 restaurants can be found before terminating the restaurant stream
            
            let numFails = 0;
            
            let start = 0;
            let radius = radiusStep;
            
            const nextRadius = function() {
                // doesn't work, b/c Zomato still returns same restaurants in inner radius
                // start = 0;
                radius += radiusStep;
            };
            
            let restaurantNum = 0;
            
            const resolves = [];
            const promises = [];
            const restaurantStack = [];
            
            let numPrefetched = 0;
            
            const searchAndResolve = function( //
                firstRestaurantNum,
                searchStart = start,
                searchRadius = radius,
                promisesIndex = promises.length, //
            ) {
                const promise = searchRestaurants(searchStart, count, searchRadius, getLocationFunc);
                promise.firstRestaurantNum = firstRestaurantNum;
                promise.index = promisesIndex;
                promise.attached = [];
                promises[promise.index] = promise;
                promise.then(restaurants => {
                        console.log("resolving: ");
                        console.log(promise);
                        console.log("");
                        
                        // remove self from promises
                        promises.splice(promise.index, 1);
                        for (let i = promise.index; i < promises.length; i++) {
                            promises[i].index--;
                        }
                        
                        console.log(promises.map(e => e.firstRestaurantNum));
                        
                        if (restaurants.length === 0) {
                            // in case radius hasn't been updated yet, update it
                            if (radius === searchRadius) {
                                nextRadius();
                            }
                            
                            // since this promise is being re-run after the other ones,
                            // their firstRestaurantNum needs to be updated
                            for (let i = promise.index; i < promises.length; i++) {
                                promises[i].firstRestaurantNum -= count;
                            }
                            
                            // try again w/ next parameters (which should have already been advanced)
                            searchAndResolve(firstRestaurantNum);
                            return;
                        }
                        
                        const resolveResolves = function() {
                            const numResolving = Math.min(resolves.length, restaurants.length);
                            const resolving = resolves.splice(0, numResolving);
                            // splice off in one call to avoid race condition
                            // hopefully a native method is atomic
                            // resolve as many as possible
                            let i = 0;
                            for (; i < numResolving; i++) {
                                if (i === 0) {
                                    console.log(promise);
                                    console.log("resolving " + resolving[i].restaurantNum + " to " + resolving.last().restaurantNum);
                                    console.log("restaurants " + restaurants[i].originalNum + " to " + restaurants.last().originalNum);
                                    console.log("");
                                }
                                restaurants[i].num = resolving[i].restaurantNum;
                                resolving[i](restaurants[i]);
                            }
                            // if not enough resolves waiting,
                            // add rest of restaurants to restaurantStack in reverse
                            restaurantStack.addAll(restaurants.slice(i).reverse());
                            
                            console.log("resolving attached (from " + promise.firstRestaurantNum + ")");
                            promise.attached.forEach(resolver => resolver());
                        };
                        
                        const lastPromise = promises[promise.index - 1];
                        if (lastPromise) {
                            console.log("attaching " + promise.firstRestaurantNum + " onto " + lastPromise.firstRestaurantNum);
                            // if there is a previous promise, attach to that one
                            // this ensures that all the restaurants return in order
                            lastPromise.attached.push(resolveResolves);
                        } else {
                            resolveResolves();
                        }
                    })
                    .catch(error => {
                        console.log(error);
                        numFails++;
                        // try again w/ same parameters
                        searchAndResolve(firstRestaurantNum, searchStart, searchRadius, promise.index);
                    });
                
                // advance inner "loop"
                start += count;
                // advance outer "loop"
                if (start >= maxStart) {
                    nextRadius();
                }
            };
            
            const parentLastChildHasNoMoreRestaurants = function(parent) {
                const last = parent.lastChild;
                return last && last.hasOwnProperty("hasMoreRestaurants") && !last.hasMoreRestaurants;
            };
            
            return {
                
                next: function() {
                    if (numFails >= maxFails) {
                        return Promise.reject(new Error("0 restaurants found " + numFails + " in a row"));
                    }
                    if (restaurantNum >= maxStart) {
                        return Promise.reject(new Error("No more restaurants at location available"));
                    }
                    const savedRestaurantNum = restaurantNum;
                    restaurantNum++;
                    
                    if (restaurantStack.length > 0) {
                        const restaurant = restaurantStack.pop();
                        restaurant.num = savedRestaurantNum;
                        return Promise.resolve(restaurant);
                    }
                    
                    if (promises.length === 0 || promises.last().firstRestaurantNum + count <= savedRestaurantNum) {
                        searchAndResolve(savedRestaurantNum);
                    }
                    
                    return new Promise(resolve => {
                        resolve.restaurantNum = savedRestaurantNum;
                        resolves.push(resolve);
                    });
                },
                
                currentRestaurantNum: function() {
                    return restaurantNum;
                },
                
                hasMore: function() {
                    return numFails <= maxFails && restaurantNum < maxStart;
                },
                
                addNextTo: function(parent, restaurantToDivFunc, numPrefetch = count >> 1) {
                    if (!restaurantToDivFunc) {
                        throw new Error("restaurantToDivFunc not supplied");
                    }
                    const restaurantToDiv = restaurantToDivFunc;
                    
                    if (!this.hasMore()) {
                        return Promise.resolve(false);
                    }
                    
                    if (parentLastChildHasNoMoreRestaurants(parent)) {
                        return Promise.resolve(false);
                    }
                    
                    const addRestaurantDivToParent = function(parent, restaurant) {
                        const div = document.createElement("div");
                        div.hasMoreRestaurants = true;
                        parent.appendChild(div);
                        div.hasMoreRestaurants = restaurant != null;
                        restaurantToDiv(div, restaurant);
                    };
                    
                    numPrefetch++;
                    numPrefetch -= numPrefetched;
                    if (numPrefetch >= 0) {
                        const numSearches = Math.ceil(numPrefetch / count);
                        for (let i = 0; i < numSearches; i++) {
                            searchAndResolve(i * count + restaurantNum);
                            numPrefetched += count;
                        }
                    }
                    
                    numPrefetched--;
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
        
        return {
            getRestaurant: getRestaurant,
            getReviews: getReviews,
            newRestaurants: newRestaurants,
        };
        
    };
    
    const MainPageModule = function(LocationModule, ZomatoModule) {
        
        const zipCodeFieldId = "#zipCode"; // TODO
        const zipCodeEnterButtonId = "#enterZipCode"; // TODO
        const locateButtonId = "#locate"; // TODO
        const moreRestaurantsButtonId = "#moreRestaurants"; // TODO
        const restaurantListId = "#restaurants"; // TODO
        
        const zipCodeField = $(zipCodeFieldId)[0];
        const zipCodeEnterButton = $(zipCodeEnterButtonId)[0];
        const locateButton = $(locateButtonId)[0];
        const moreRestaurantsButton = $(moreRestaurantsButtonId)[0];
        const restaurantList = $(restaurantListId)[0];
        
        console.log([zipCodeField, zipCodeEnterButton, locateButton, moreRestaurantsButton, restaurantList]);
        
        let useZipCode = false;
        let lastLocation = null;
        
        zipCodeEnterButton.addEventListener("click", event => {
            useZipCode = true;
            LocationModule.getLocation.dontUseGps();
        });
        
        locateButton.addEventListener("click", event => {
            useZipCode = false;
            LocationModule.getLocation.useGps();
        });
        
        const zipCodeLocation = function(zipCode) {
            // TODO need to use another API to convert zipCode to lat, long
        };
        
        const restaurants = ZomatoModule.newRestaurants(() => {
            return new Promise(resolve => {
                if (useZipCode) {
                    if (lastLocation) {
                        resolve(lastLocation);
                        return;
                    }
                    const zipCodeText = zipCodeField.innerText;
                    if (zipCodeText && zipCodeText.length === 5) {
                        zipCodeLocation(zipCodeText)
                            .then(coords => resolve(coords));
                        return;
                    }
                }
                return LocationModule.getLocation()
                    .then(coords => resolve(coords));
            });
        });
        
        /**
         * Add Zomato restaurant data to a div.
         *
         * @param {HTMLDivElement} div div restaurant data will be added to
         * @param {RestaurantL3} restaurant RestaurantL3 (from Zomato) restaurant data
         */
        const restaurantToDiv = function(div, restaurant) {
            const p = document.createElement("div");
            // TODO finish this function
            div.appendChild(p);
            if (restaurant == null) {
                p.innerText = "No more restaurants available";
            } else {
                p.innerText = restaurant.name;
            }
            console.log(restaurant);
        };
        
        moreRestaurantsButton.addEventListener("click", event => {
            restaurants.addNextTo(restaurantList, restaurantToDiv);
        });
        
        zipCodeField.addEventListener("keydown", event => {
            if ("value" in zipCodeField && zipCodeField.value) {
                console.log("Input Value:", zipCodeField.value);
                console.log("removing carousel attribute...");
                const carousel = $("#welpcarousel")[0];
                console.log("a...=");
                console.log(carousel);
                carousel.removeAttribute("data-ride");
            }
        });
        
    };
    
    (function main() {
        const locationModule = LocationModule();
        const zomatoModule = ZomatoModule(locationModule, "3332e206cdbcedf5e11ebdf84dec2b8c");
        
        const test = function() {
            const restaurants = zomatoModule.newRestaurants();
            window.addRestaurant = () => restaurants.addNextTo(document.body, (div, restaurant) => {
                if (restaurant == null) {
                    div.innerText = "No more restaurants available";
                    return;
                }
                div.innerText = restaurant.num + ": " + restaurant.name + "(" + restaurant.originalNum + ")";
            });
            
            for (let i = 0; i < 100; i++) {
                addRestaurant();
            }
        };
        
        $(() => {
            const mainPageModule = MainPageModule(locationModule, zomatoModule);
            
            // test();
        });
    })();
    
})(window);