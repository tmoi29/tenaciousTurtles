(function welp(_outer) {
    "use strict";
    
    const outer = _outer || {};
    
    Array.prototype.addAll = function(elements) {
        this.push.apply(this, elements);
    };
    
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
    
    const newDiv = function() {
        return document.createElement("div");
    };
    
    HTMLElement.prototype.withId = function(id) {
        if (id) {
            this.id = id;
        }
        return this;
    };
    
    HTMLElement.prototype.withClass = function(klass) {
        if (klass) {
            this.classList.add(klass);
        }
        return this;
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
        
        const shouldSendCoords = false; // don't send coords back to server for now
        
        const newCoords = function(latitude, longitude) {
            return {
                latitude: latitude,
                longitude: longitude
            };
        };
        
        const sendCoords = function(coords) {
            if (!shouldSendCoords) {
                return;
            }
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
        
        const zipCodeLocation = function(zipCode) {
            return fetch("maps.googleapis.com/maps/api/geocode/json?address=" + zipCode)
                .then(response => response.json())
                .then(json => {
                    const location = json.geometry.location;
                    console.log("location for " + zipCode);
                    console.log(location);
                    return {
                        latitude: location.lat,
                        longitude: location.lng,
                    };
                });
        };
        
        return {
            getLocation: getLocation,
            zipCodeLocation: zipCodeLocation,
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
            
            const nextImmediately = function() {
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
            };
            
            return {
                
                next: function(numPrefetch = count >> 1) {
                    if (!this.hasMore()) {
                        return Promise.resolve(null);
                    }
                    
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
                        nextImmediately()
                            .then(restaurant => {
                                resolve(restaurant);
                            })
                            .catch(error => {
                                console.log(error);
                                resolve(null);
                                reject(error);
                            });
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
                    
                    return new Promise((resolve, reject) => {
                        this.next(numPrefetch)
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
        
        return {
            getRestaurant: getRestaurant,
            getReviews: getReviews,
            newRestaurants: newRestaurants,
        };
        
    };
    
    const RestaurantListModule = function() {
        
        const newRestaurantCol = function(restaurantToDiv) {
            
            const col = newDiv().withClass("col-xs-3");
            const panel = newDiv().withClass("panel").withClass("panel-default");
            const body = newDiv().withClass("panel-body");
            const div = newDiv();
            
            let ownRestaurant = null;
            
            col.appendChild(panel);
            panel.appendChild(body);
            body.appendChild(div);
            
            col.getRestaurant = function() {
                return ownRestaurant;
            };
            
            return {
                
                appendTo: function(parent) {
                    parent.appendChild(col);
                    return this;
                },
                
                setRestaurant: function(restaurant) {
                    ownRestaurant = restaurant;
                    restaurantToDiv(div, restaurant);
                },
                
                getRestaurant: function() {
                    return ownRestaurant;
                },
                
                addEventListeners: function(listeners) {
                    for (const eventType in listeners) {
                        if (listeners.hasOwnProperty(eventType)) {
                            col.addEventListener(eventType, listeners[eventType]);
                        }
                    }
                    return this;
                },
                
            };
            
        };
        
        const newRestaurantRow = function(restaurantToDiv, width) {
            
            const row = newDiv().withClass("row");
            const cols = [];
            
            let eventListeners = null;
            
            return {
                
                appendTo: function(parent) {
                    parent.appendChild(row);
                    return this;
                },
                
                getRestaurant: function(i) {
                    return cols[i].getRestaurant();
                },
                
                setRestaurant: function(i, restaurant) {
                    cols[i].setRestaurant(restaurant);
                },
                
                addRestaurant: function(restaurant) {
                    if (cols.length === width) {
                        return false;
                    }
                    const col = newRestaurantCol(restaurantToDiv)
                        .appendTo(row)
                        .addEventListeners(eventListeners);
                    col.setRestaurant(restaurant);
                    cols.push(col);
                    return true;
                },
                
                withEventListeners: function(listeners) {
                    eventListeners = listeners;
                    return this;
                },
                
            };
            
        };
        
        const newRestaurantList = function(restaurantToDiv, id, klass, width = 4) {
            
            const div = newDiv().withId(id).withClass(klass);
            const rows = [];
            
            let i = 0;
            let j = 0;
            let noMoreRestaurants = false;
            
            let eventListeners = null;
            
            const getRow = function(restaurantNum) {
                return rows[Math.trunc(restaurantNum / width)];
            };
            
            return {
                
                appendTo: function(parent) {
                    parent.appendChild(div);
                    return this;
                },
                
                appendChild: function(child) {
                    this.addRestaurant(child);
                },
                
                addRestaurant: function(restaurant) {
                    if (noMoreRestaurants) {
                        return false;
                    }
                    if (restaurant === null) {
                        noMoreRestaurants = true;
                        const center = document.createElement("center");
                        div.appendChild(center);
                        const p = document.createElement("p");
                        center.appendChild(p);
                        p.innerText = "No More Restaurants Available";
                        return false;
                    }
                    
                    if (j === 0) {
                        rows.push(
                            newRestaurantRow(restaurantToDiv, width)
                                .appendTo(div)
                                .withEventListeners(eventListeners)
                        );
                    }
                    rows[i].addRestaurant(restaurant);
                    j++;
                    if (j === width) {
                        i++;
                        j = 0;
                    }
                    return true;
                },
                
                getRestaurant: function(restaurantNum) {
                    return getRow(restaurantNum).getRestaurant(restaurantNum % width);
                },
                
                setRestaurant: function(restaurantNum, restaurant) {
                    getRow(restaurantNum).setRestaurant(restaurantNum % width, restaurant);
                },
                
                forEach: function(restaurantConsumer) {
                    const maxI = i;
                    // noinspection UnnecessaryLocalVariableJS
                    const maxJ = j;
                    for (let i = 0; i < maxI; i++) {
                        for (let j = 0; j < maxJ; j++) {
                            restaurantConsumer(this.getRestaurant(i), i);
                        }
                    }
                },
                
                withEventListeners: function(listeners) {
                    eventListeners = listeners;
                    return this;
                },
                
            };
        };
        
        return {
            newRestaurantList: newRestaurantList,
        };
        
    };
    
    const RestaurantReviewPageModule = function(ZomatoModule) {
        
        const url = "/reviews"; // FIXME
        
        const fillReviewPage = function(window) {
            const restaurant = window.restaurant;
            const restaurantId = restaurant.id;
            
            console.log(restaurant);
            
            ZomatoModule.getReviews(restaurantId)
                .then(rewiews => {
                    rewiews.user_reviews
                        .map(review => review.review)
                        .forEach(review => {
                            const rating = review.rating;
                            const text = review.review_text;
                            console.log(rating);
                            console.log(text);
                            // TODO
                        });
                });
            
            // TODO depends on how we want it to look
        };
        
        const openRestaurantReviewsInNewPage = function(restaurant) {
            const newPage = window.open(url);
            newPage.restaurant = restaurant;
            newPage.$ = newPage.jQuery = $; // import jQuery
            newPage.$(() => {
                fillReviewPage(newPage);
            });
            return newPage;
        };
        
        return {
            openRestaurantReviewsInNewPage: openRestaurantReviewsInNewPage,
        };
        
    };
    
    const RestaurantsPageModule = function( //
        LocationModule,
        ZomatoModule,
        RestaurantListModule,
        RestaurantReviewPageModule, //
    ) {
        
        const zipCodeField = $("#zipCode")[0];
        const zipCodeEnterButton = $("#enterZipCode")[0];
        const locateButton = $("#locate")[0];
        const moreRestaurantsButton = $("#moreRestaurants")[0];
        const restaurantListDiv = $("#restaurants")[0];
        
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
        
        const restaurants = ZomatoModule.newRestaurants(() => {
            return new Promise(resolve => {
                if (useZipCode) {
                    if (lastLocation) {
                        resolve(lastLocation);
                        return;
                    }
                    const zipCodeText = zipCodeField.innerText;
                    if (zipCodeText && zipCodeText.length === 5) {
                        LocationModule.zipCodeLocation(zipCodeText)
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
            div.withClass("klass");
            console.log(div.classList);
            console.log(div);
            console.log(restaurant);
            
            // TODO make this better and fancier
            
            const name = document.createElement("h1");
            div.appendChild(name);
            name.innerText = restaurant.name;
            
            const rating = document.createElement("p");
            div.appendChild(rating);
            rating.innerText = "Rating: " +
                (restaurant.user_rating.rating_text === "Not rated"
                        ? "N/A"
                        : restaurant.user_rating.aggregate_rating
                );
            
	    var img_div = document.createElement("div").withClass("image-holder");
	    console.log("restaurant.thumb");
	    console.log(restaurant.thumb);
	    console.log("img_div");
	    console.log(img_div);
	    img_div.style.cssText = 'background-image: url(' + restaurant.thumb + ')';
	    div.appendChild(img_div);
        };
        
        const restaurantList = RestaurantListModule.newRestaurantList(restaurantToDiv, null, null, 4)
            .appendTo(restaurantListDiv)
            .withEventListeners({
                click: function(event) {
                    console.log(event);
                    console.log(this);
                    RestaurantReviewPageModule.openRestaurantReviewsInNewPage(this.getRestaurant());
                },
            });
        
        const addRestaurant = function() {
            restaurants.next()
                .then(restaurant => {
                    restaurantList.addRestaurant(restaurant);
                });
        };
        
        const numInitialRestaurants = 20;
        
        new Range(0, numInitialRestaurants).forEach(addRestaurant);
        
        moreRestaurantsButton.addEventListener("click", addRestaurant);
        
    };
    
    (function main() {
        const locationModule = LocationModule();
        const zomatoModule = ZomatoModule(locationModule, "3332e206cdbcedf5e11ebdf84dec2b8c");
        const restaurantListModule = RestaurantListModule();
        const restaurantReviewPageModule = RestaurantReviewPageModule(zomatoModule);
        
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
            const restaurantsPageModule = RestaurantsPageModule(
                locationModule,
                zomatoModule,
                restaurantListModule,
                restaurantReviewPageModule);
            // test();
        });
    })();
    
})(window);