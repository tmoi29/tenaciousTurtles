(function welp(_outer) {
    "use strict";
    
    const outer = _outer || {};
    
    Array.prototype.addAll = function(elements) {
        this.push.apply(this, elements);
    };
    
    Array.prototype.last = function() {
        return this[this.length - 1];
    };
    
    Array.prototype.clear = function() {
        this.length = 0;
    };
    
    // can't extend Object.prototype
    // because it breaks jQuery
    Object.noNulls = function(obj) {
        for (const field in obj) {
            if (obj.hasOwnProperty(field)) {
                const value = obj[field];
                if (value === null || value === undefined) {
                    delete obj[field];
                }
            }
        }
        return obj;
    };
    
    Object.defineProperty(Object.prototype, "extendSafely", {
        value: function(property, value) {
            Object.defineProperty(this, property, {
                value: value,
                writable: false,
                enumerable: false,
            });
        },
        writable: false,
        enumerable: false,
    });
    
    Object.prototype.extendSafely("noNulls", Object.noNulls);
    
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
    
    FormData.of = function(fields) {
        const form = new FormData();
        for (const field in fields) {
            if (fields.hasOwnProperty(field)) {
                form.set(field, fields[field]);
            }
        }
        return form;
    };
    
    const Range = window.Range = function(start, end) {
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
    
    const LocationModule = function(_googleGeocodingApiKey) {
        
        const googleGeocodingApiKey = _googleGeocodingApiKey || prompt("Enter Google Geocoding API key:");
        
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
            return new Promise(resolve => {
                navigator.geolocation.getCurrentPosition(position => {
                    resolve(processLocation(position.coords));
                }, error => {
                    console.log(error);
                    onError().then(resolve);
                });
            });
        };
        
        const getIpLocation = function() {
            return new Promise((resolve, reject) => {
                $.getJSON("//freegeoip.net/json/?callback=?", resolve);
            })
                .then(processLocation)
                .then(e => {
                    console.log(e);
                    return e;
                });
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
            return fetch("https://maps.googleapis.com/maps/api/geocode/json?" + $.param({
                address: zipCode,
                key: googleGeocodingApiKey,
            }), {
                cache: "force-cache",
            })
                .then(response => response.json())
                .then(json => {
                    const location = json.results[0].geometry.location;
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
    
    const ZomatoModule = function(LocationModule, zomatoApiKey) {
        
        const apiKey = zomatoApiKey || prompt("Enter Zomato API key:");
        
        const maxNumZomatoFails = 20;
        let numZomatoFails = 0;
        
        const getZomato = function(route, query) {
            const baseUrl = "https://developers.zomato.com/api/v2.1/";
            const url = baseUrl + route + "?" + $.param(Object.noNulls(query));
            // + Object.entries(query)
            //     .filter(e => e[1]) // filter out false values
            //     .map(e => e[0] + "=" + e[1])
            //     .join("&");
            console.log(url);
            console.log("numZomatoFails: " + numZomatoFails);
            if (numZomatoFails > maxNumZomatoFails) {
                return Promise.reject("too many Zomato API calls failed (" + numZomatoFails + ")");
            }
            
            return fetch(url, {
                method: "GET",
                headers: {
                    "User-Key": apiKey,
                },
                cache: "force-cache", // fetch actually allows client to cache unconditionally
            })
                .then(response => response.json())
                .catch(error => {
                    console.log(error);
                    numZomatoFails++;
                })
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
                // round coords to take advantage of browser cache
                // 3 decimal digits is still pretty accurate (less than a block or so)
                lat: coords.latitude.toFixed(3),
                lon: coords.longitude.toFixed(3),
                radius: radius,
                cuisines: cuisines,
                establishment_type: establishmentType,
                collection_id: collectionId,
                category: category,
                sort: sortBy,
                order: ascending ? "asc" : "desc",
            });
        };
        
        const searchRestaurantsRaw = function(start, count, radius, getLocationFunc, query) {
            // Promises can resolve nested Promises
            return getLocationFunc()
                .then(coords => {
                    console.log(coords);
                    return search(
                        null, "zone", query, start, count,
                        coords, radius,
                        null, null,
                        null, null,
                        "real_distance", true);
                });
        };
        
        const searchRestaurants = function(start, count, radius, getLocationFunc, query) {
            return searchRestaurantsRaw(start, count, radius, getLocationFunc, query)
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
         * @param {string | undefined} query
         * @return a new Restaurants object
         */
        const newRestaurants = function(getLocationPromiseFunc, query) {
            
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
                console.log(numFails);
                if (numFails >= maxFails) {
                    return;
                }
                const promise = searchRestaurants(searchStart, count, searchRadius, getLocationFunc, query);
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
                    return numFails < maxFails && restaurantNum < maxStart;
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
    
    const GettyModule = function(gettyApiKey) {
        
        const apiKey = gettyApiKey || prompt("Enter Getty API key:");
        
        const queriesPerSecond = 5;
        
        let lastPromise = Promise.resolve();
        
        const searchImages = function(phrase, sortOrder) {
            const url = "https://api.gettyimages.com/v3/search/images?"
                + $.param({
                    phrase: phrase,
                    sort_order: sortOrder,
                });
            console.log(url);
            return new Promise(resolve => {
                lastPromise = lastPromise
                // delay each call, use queriesPerSecond - 1 to be safe
                    .then(() => new Promise(resolve => setTimeout(resolve, 1000 / queriesPerSecond)))
                    .then(() => {
                        return fetch(url, {
                            method: "GET",
                            headers: {
                                "Api-Key": apiKey,
                            },
                            // body: {
                            //     phrase: phrase,
                            //     sort_order: sortOrder,
                            // },
                            cache: "force-cache",
                        });
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log(url);
                        console.log(data);
                        return data;
                    })
                    .then(data => {
                        resolve(data.images);
                    })
                    .catch(console.log);
            });
        };
        
        const getImageUrl = function(phrase, sortOrder) {
            return searchImages(phrase, sortOrder)
                .then(images => {
                    if (images.length === 0) {
                        return "";
                    }
                    return images[0].display_sizes[0].uri;
                });
        };
        
        return {
            searchImages: searchImages,
            getImageUrl: getImageUrl,
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
        
        const newRestaurantList = function(restaurantToDiv, id, klass, width = 4, errorText="No More Restaurants Available") {
            
            let div = null;
            let _parent = null;
            
            const initDiv = function() {
                div = newDiv().withId(id).withClass(klass);
            };
            
            initDiv();
            
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
                    _parent = parent;
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
                        p.innerText = errorText;
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
                    console.log(restaurantNum);
                    console.log(rows);
                    console.log(getRow(restaurantNum));
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
                
                reset: function() {
                    const parent = _parent;
                    i = 0;
                    j = 0;
                    rows.clear();
                    if (parent) {
                        div.remove();
                    }
                    initDiv();
                    if (parent) {
                        parent.appendChild(div);
                    }
                },
                
            };
        };
        
        return {
            newRestaurantList: newRestaurantList,
        };
        
    };
    
    const RestaurantImageModule = function() {
        
        const getGoogleImgUrlsOwnServer = function(query) {
            return fetch("/google_image_search?" + $.param({query: query}))
                .then(response => response.json())
                .catch(console.log);
        };
        
        /*
        Using our own Flask server is too slow
        because Flask can't do asynchronous requests,
        so it has to wait for the whole Google request
        before starting the next request.
        By using a dedicated CORS server like cors-anywhere,
        we can still make CORS requests to google.com,
        which doesn't allow CORS requests,
        and at the same time, still do async requests,
        meaning the latency is still the same,
        but the throughput is much, much higher.
         */
        
        const getGoogleImgUrlsCorsServer = function(query) {
            return fetch("https://cors-anywhere.herokuapp.com/https://www.google.com/search?"
                + $.param({
                    q: query,
                    tbm: "isch",
                }), {
                cache: "force-cache",
            })
                .then(response => {
                    if (!response.ok) {
                        return null;
                    }
                    return response.text();
                })
                .then(html => {
                    if (html === null) {
                        return null;
                    }
                    const urls = [];
                    const fieldName = "\"ou\":";
                    let i;
                    while ((i = html.indexOf(fieldName, i)) !== -1) {
                        i += fieldName.length;
                        i += 1;
                        const end = html.indexOf("\"", i);
                        const url = html.substring(i, end);
                        urls.push(url);
                        i = end + 1;
                    }
                    return urls;
                });
        };
        
        const getGoogleImgUrls = window.getGoogleImgUrls = function(query) {
            return getGoogleImgUrlsCorsServer(query)
                .then(imgUrls => {
                    if (imgUrls !== null) {
                        return imgUrls;
                    }
                    // fallback to our own CORS server
                    // in case cors-anywhere fails
                    // (sometimes it sends 429 (Too Many Requests)
                    return getGoogleImgUrlsOwnServer(query);
                });
        };
        
        const getRestaurantImgUrls = function(restaurant) {
            const imgUrl = restaurant.featured_image || restaurant.thumb;
            if (imgUrl) {
                return Promise.resolve([imgUrl]);
            }
            // const phrase = restaurant.cuisines + " Food";
            const phrase = restaurant.name;
            return getGoogleImgUrls(phrase);
            // return GettyModule.getImageUrl(phrase, "best_match");
        };
        
        const setRestaurantImgSrc = function(img, restaurant) {
            return getRestaurantImgUrls(restaurant)
                .then(imgUrls => {
                    imgUrls.reverse();
                    // keep reloading next url until successful or no more urls
                    img.onerror = function() {
                        const imgUrl = imgUrls.pop();
                        if (imgUrl === undefined) {
                            img.onerror = undefined;
                            return;
                        }
                        img.src = imgUrl;
                    };
                    const promise = new Promise(resolve => {
                        img.onload = function() {
                            resolve(img.src);
                        };
                    });
                    img.src = imgUrls.pop();
                    return promise;
                });
        };
        
        const setRestaurantBackgroundImgUrlBroken = function(imgDiv, restaurant) {
            return getRestaurantImgUrls(restaurant)
                .then(imgUrls => {
                    for (const imgUrl of imgUrls) {
                        imgDiv.style.backgroundImage = "url(" + imgUrl + ")";
                        // if imgUrl is corrupt or something,
                        // imgDiv.style.cssText will be an empty string ""
                        if (imgDiv.style.backgroundImage) {
                            restaurant.img = imgUrl;
                            console.log(imgUrl);
                            // FIXME background img url not always false when error
                            return imgUrl;
                        }
                    }
                    restaurant.img = "";
                    console.log("no image found for: ");
                    console.log(imgDiv);
                    return "";
                });
        };
        
        const setRestaurantBackgroundImgUrl = function(imgDiv, restaurant) {
            const img = document.createElement("img");
            img.style.display = "none";
            imgDiv.appendChild(img);
            return setRestaurantImgSrc(img, restaurant)
                .then(url => {
                    img.remove();
                    imgDiv.style.backgroundImage = "url(" + url + ")";
                    return url;
                });
        };
        
        return {
            getGoogleImgUrls: getRestaurantImgUrls,
            getRestaurantImgUrls: getRestaurantImgUrls,
            setRestaurantImgSrc: setRestaurantImgSrc,
            setRestaurantBackgroundImgUrl: setRestaurantBackgroundImgUrl,
        };
        
    };
    
    const WelpRatingsModule = function() {
        
        const url = "/all_review_ratings_raw";
        
        const newRatingsMap = function() {
            const ratings = new Map();
            
            ratings.addRating = function(restaurantId, rating, count = 1) {
                const newRatings = new Array(count).fill(rating);
                if (ratings.has(restaurantId)) {
                    const ratingObj = ratings.get(restaurantId);
                    ratingObj.ratings.addAll(newRatings);
                    const numRatings = ratingObj.numRatings;
                    ratingObj.averageRating = (((ratingObj.averageRating * numRatings) + (rating * count))
                        / (numRatings + count)).toFixed(1);
                    ratingObj.numRatings += count;
                } else {
                    ratings.set(restaurantId, {
                        ratings: newRatings,
                        numRatings: count,
                        averageRating: rating,
                    });
                }
            };
            
            return ratings;
        };
        
        const parseRawWelpRatings = function(rawWelpRatings) {
            const ratings = newRatingsMap();
            for (const pair of rawWelpRatings) {
                const restaurantId = pair[0];
                const rating = pair[1];
                ratings.addRating(restaurantId, rating);
            }
            return ratings;
        };
        
        const ratingToStarsHtml = function(rating) {
            rating = Math.round(rating);
            return new Range(0, 5)
                .map(i => {
                    return "<i class=\"glyphicon glyphicon-star" + (i + 1 > rating ? "-empty" : "") + "\"></i>";
                })
                .join("");
        };
        
        const setRatingTextStatic = function(ratingElem, welpRating, zomatoRating) {
            const numZomatoRatings = parseInt(zomatoRating.votes);
            const isRated = numZomatoRatings !== 0;
            const averateZomatoRating = !isRated ? NaN : parseFloat(zomatoRating.aggregate_rating);
            
            const setRatingText = function(rating, count) {
                ratingElem.innerHTML = "Rating: " +
                    (count === 0
                            ? "N/A"
                            : (
                                ratingToStarsHtml(rating) +
                                " " +
                                rating.toString() +
                                " (out of " +
                                count.toString() +
                                " reviews)"
                            )
                    );
            };
            
            // set initial ratings as Zomato only
            setRatingText(averateZomatoRating, numZomatoRatings);
            
            if (isRated) {
                welpRating.addRating(averateZomatoRating, numZomatoRatings);
            }
            // update ratings w/ Welp Rating ASAP
            welpRating.getRatings()
                .then(rating => {
                    if (rating) {
                        setRatingText(rating.averageRating, rating.numRatings);
                    }
                });
        };
        
        const newWelpRatings = function() {
            
            let _ratings = null;
            let ratingsPromise = null;
            
            const ratings = function() {
                if (_ratings) {
                    console.log("already fetched welpRatings");
                    return Promise.resolve(_ratings);
                }
                if (ratingsPromise) {
                    console.log("already fetching welpRatings");
                    return ratingsPromise;
                }
                console.log("fetching welpRatings");
                return ratingsPromise = new Promise(resolve => {
                    fetch(url)
                        .then(response => response.json())
                        .then(rawRatings => parseRawWelpRatings(rawRatings))
                        .then(ratings => resolve(ratings))
                        .catch(error => resolve(new Map()));
                })
                    .then(ratings => {
                        _ratings = ratings;
                        return ratings;
                    });
            };
            
            return {
                
                forRestaurant: function(restaurantId) {
                    if ($.type(restaurantId) === "string") {
                        restaurantId = parseInt(restaurantId);
                    }
                    
                    return {
                        
                        getRatings: function() {
                            return ratings()
                                .then(ratings => ratings.get(restaurantId));
                        },
                        
                        getRatingAverage: function() {
                            return this.getRatings(restaurantId)
                                .then(rating => rating.averageRating);
                        },
                        
                        getNumRatings: function() {
                            return this.getRatings()
                                .then(rating => rating.numRatings);
                        },
                        
                        addRating: function(rating, count = 1) {
                            ratings()
                                .then(ratings => {
                                    ratings.addRating(restaurantId, rating, count);
                                });
                        },
                        
                        setRatingText: function(ratingElem, zomatoRating) {
                            setRatingTextStatic(ratingElem, this, zomatoRating);
                        },
                        
                    };
                },
                
                load: function() {
                    ratings();
                    return this;
                },
                
            };
            
        };
        
        return {
            newWelpRatings: newWelpRatings,
        };
        
    };
    
    const RestaurantsSubPageModule = function( //
        ZomatoModule, RestaurantListModule, RestaurantImageModule, WelpRatingsModule) {
        
        const welpRatings = WelpRatingsModule.newWelpRatings();
        welpRatings.load(); // force request to server immediately
        
        /**
         * Add Zomato restaurant data to a div.
         *
         * @param {HTMLDivElement} div div restaurant data will be added to
         * @param {RestaurantL3} restaurant RestaurantL3 (from Zomato) restaurant data
         */
        const restaurantToDiv = function(div, restaurant) {
            if (!restaurant) {
                return;
            }
            
            // {empty: true} is passed in ProfilePageModule as restaurant placeholder
            if ("empty" in restaurant && restaurant.empty === true) {
                return;
            }
            
            div.withClass("klass");
            console.log(restaurant);
            
            const name = document.createElement("h1");
            div.appendChild(name);
            name.innerText = restaurant.name;
            
            const rating = document.createElement("p");
            div.appendChild(rating);
            
            welpRatings.forRestaurant(restaurant.id)
                .setRatingText(rating, restaurant.user_rating);
            
            const imgDiv = newDiv().withClass("image-holder");
            div.appendChild(imgDiv);
            
            RestaurantImageModule.setRestaurantBackgroundImgUrl(imgDiv, restaurant);
        };
        
        const openRestaurantInfoInNewPage = function(restaurant) {
            const newPage = window.open("/restaurant_info?restaurant_id=" + restaurant.id + "&name=" + restaurant.name);
            newPage.restaurant = restaurant;
        };
        
        const createRestaurantList = function(errorText="No More Restaurants Available") {
            return RestaurantListModule.newRestaurantList(restaurantToDiv, null, null, 4, errorText)
                .withEventListeners({
                    click: function(event) {
                        openRestaurantInfoInNewPage(this.getRestaurant());
                    },
                });
        };
        
        return {
            createRestaurantList: createRestaurantList,
        };
        
    };
    
    const RestaurantsPageModule = function(LocationModule, ZomatoModule, RestaurantsSubPageModule) {
        
        let useZipCode = false;
        let lastLocation = null;
        let query = undefined;
        
        const switchLocatorAndReload = function(useGps) {
            // if caching isn't properly, won't be able to change to new zipcode
            // easier to just not use caching
            // let browser cache as many requests as possible instead
            lastLocation = null;
            
            console.log("Now using " + (useGps ? "GPS" : "Zipcode"));
            useZipCode = !useGps;
            LocationModule.getLocation.useGps(useGps);
            loadInitialRestaurants(true);
        };
        
        const onSearch = function(searchField) {
            query = searchField.value;
            loadInitialRestaurants(true);
        };
        
        const onZipCodeEnter = function() {
            switchLocatorAndReload(false);
        };
        
        const onLocate = function() {
            switchLocatorAndReload(true);
        };
        
        const getLocation = function() {
            if (useZipCode) {
                if (lastLocation) {
                    return Promise.resolve(lastLocation);
                }
                const zipCodeText = getLocation.zipCodeField.value;
                if (zipCodeText /*&& zipCodeText.length === 5*/) {
                    return LocationModule.zipCodeLocation(zipCodeText)
                        .then(coords => {
                            lastLocation = coords;
                            return coords;
                        });
                }
            }
            return LocationModule.getLocation();
        };
        getLocation.zipCodeField = null;
        
        let restaurants = null;
        
        const initRestaurants = function() {
            console.log("using query: " + query);
            restaurants = ZomatoModule.newRestaurants(getLocation, query);
        };
        
        initRestaurants();
        
        const restaurantList = RestaurantsSubPageModule.createRestaurantList("No More Restaurants Available");
        
        const addRestaurant = function() {
            return restaurants.next()
                .then(restaurant => {
                    restaurantList.addRestaurant(restaurant);
                });
        };
        
        const numInitialRestaurants = 20;
        
        let first = true;
        
        const resetRestaurants = function() {
            first = false;
            restaurantList.reset();
            initRestaurants();
        };
        
        const loadInitialRestaurants = function(reset = false) {
            if (reset) {
                resetRestaurants();
            }
            new Range(0, numInitialRestaurants).forEach(i => {
                addRestaurant()
                    .then(() => {
                        if (first) {
                            first = false;
                            setTimeout(() => loadInitialRestaurants.topElement.scrollIntoView(), 100);
                        }
                    });
            });
        };
        loadInitialRestaurants.topElement = null;
        
        const main = function() {
            $(() => {
                $(".carousel").carousel({
                    interval: 2000,
                });
                
                const searchField = $("#searchField")[0];
                const zipCodeField = $("#zipCode")[0];
                const moreRestaurantsButton = $("#moreRestaurants")[0];
                const restaurantListDiv = $("#restaurants")[0];
                
                getLocation.zipCodeField = zipCodeField;
                
                $("#searchButton").click(() => {
                    onSearch(searchField);
                });
                
                $("#enterZipCode").click(onZipCodeEnter);
                
                $("#locate").click(onLocate);
                
                restaurantList.appendTo(restaurantListDiv);
                
                loadInitialRestaurants.topElement = searchField;
                loadInitialRestaurants();
                
                moreRestaurantsButton.addEventListener("click", () => {
                    addRestaurant();
                    console.log("scrolling");
                    // must wait for restaurant element to be added before scrolling
                    // not sure how long that will be, so try three times
                    // the closer my prediction is, the smoother the scrolling is
                    [0, 50, 100].forEach(timeout => {
                        setTimeout(() => moreRestaurantsButton.scrollIntoView(), timeout);
                    });
                });
            });
        };
        
        return {
            main: main,
            restaurantList: restaurantList,
            addRestaurant: addRestaurant,
        };
        
    };
    
    const RestaurantInfoPageModule = function(ZomatoModule, RestaurantImageModule, WelpRatingsModule) {
        
        let _restaurant = window.restaurant || undefined;
        if (_restaurant) {
            _restaurant.favorited = favorited;
        }
        
        const getRestaurant = function() {
            if (_restaurant) {
                return Promise.resolve(_restaurant);
            }
            return ZomatoModule.getRestaurant(restaurantId)
                .then(restaurant => {
                    restaurant.favorited = favorited;
                    _restaurant = restaurant;
                    return restaurant;
                });
        };
        
        let userAlreadyReviewed = false;
        
        const setUserAlreadyReviewed = function(reviewed) {
            userAlreadyReviewed = reviewed;
            $("#newReview")[0].style.display = reviewed ? "none" : "";
        };
        
        const reviewToDiv = function(div, review) {
            div.withClass("rev_div");
            // FIXME make this look nicer
            const rating = review.rating;
            const title = review.rating_text;
            const text = review.review_text;
            
            div.innerHTML = " <i>" + "Rating: " + rating + " (" + title + ")</i> <br>" + text
                + "<br>By " + review.user.name;
            
            if (username === review.user.name) {
                console.log("same user");
                setUserAlreadyReviewed(true);
                
                div.innerHTML += "<br><br>";
                
                const deleteButton = document.createElement("button")
                    .withClass("btn-warning")
                    .withId("delete");
                div.appendChild(deleteButton);
                deleteButton.innerText = "Delete";
                
                const parent = div.parentElement;
                
                deleteButton.addEventListener("click", () => {
                    postToServer("/delete_review", {})
                        .then(response => {
                            console.log("deleted review:", div);
                        })
                        .catch(error => {
                            console.log("restored review: ", div);
                            parent.prepend(div);
                            setUserAlreadyReviewed(true);
                        });
                    div.remove();
                    setUserAlreadyReviewed(false);
                });
            }
        };
        
        const addReview = function(reviewsDiv, review) {
            const reviewDiv = newDiv();
            reviewsDiv.prepend(reviewDiv);
            reviewToDiv(reviewDiv, review);
            return reviewDiv;
        };
        
        const addRestaurantInfo = function(restaurant, welpRatings) {
            const name = restaurant.name;
            const src = restaurant.img;
            const address = restaurant.location.address;
            
            const price = restaurant.price_range;
            const cuisine = restaurant.cuisines;
            const menuUrl = restaurant.menu_url;
            
            console.log(menuUrl);
            
            const nameElem = document.getElementById("name");
            nameElem.innerText = name;
            
            const img = document.getElementById("img");
            //img.width = 500;
            //img.height = 250;
            if (src) {
                img.src = src;
            }
            
            if (!src) {
                RestaurantImageModule.setRestaurantImgSrc(img, restaurant);
            }
            
            const locationElem = document.getElementById("loc");
            locationElem.innerText = address;
            
            const ratingElem = document.getElementById("rating");
            welpRatings.forRestaurant(restaurant.id)
                .setRatingText(ratingElem, restaurant.user_rating);
            
            const cuisineElem = document.getElementById("cuisine");
            cuisineElem.innerText = cuisine;
            
            const menuElem = document.getElementById("menu");
            menuElem.href = menuUrl;
            menuElem.target = "_blank"; // open in new tab
        };
        
        const postToServer = function(url, form) {
            const promise = getRestaurant()
                .then(restaurant => {
                    form.restaurant_id = restaurant.id;
                    console.log("posting to server (" + url + "):", form);
                    const promise = fetch(url, {
                        method: "POST",
                        credentials: "include",
                        mode: "same-origin",
                        body: FormData.of(form),
                    });
                    delete form.restaurant_id;
                    return promise;
                });
            
            return new Promise((resolve, reject) => {
                promise.then(response => {
                    if (response.status !== 200) {
                        // possibly b/c not logged in, although user should be
                        reject(response);
                    } else {
                        resolve(response);
                    }
                });
            });
        };
        
        let newRating = 0;
        
        const addNewReview = function(reviewsDiv) {
            if (!loggedIn) {
                alert("You must be logged in to add a review");
                return; // TODO display better error message
            }
            
            if (userAlreadyReviewed) {
                alert("You already reviewed this restaurant");
                return;
            }
            
            const reviewText = $("#newReviewText")[0];
            
            const review = {
                user: {name: username},
                rating: newRating,
                rating_text: {
                    0: "Not rated",
                    1: "Bad",
                    2: "Okay",
                    3: "Good",
                    4: "Great",
                    5: "Insane!",
                }[newRating],
                review_text: reviewText.value,
            };
            
            const reviewDiv = addReview(reviewsDiv, review);
            
            postToServer("/add_review", {
                rating: review.rating,
                review_title: review.rating_text,
                review_content: review.review_text,
            })
                .then(response => {
                    console.log("added review: ", review);
                })
                .catch(response => {
                    reviewDiv.remove();
                    reviewText.value = review.review_text;
                    setUserAlreadyReviewed(false);
                });
            
            reviewText.value = "";
        };
        
        const toggleDisplay = function(element, display) {
            element.style.display = display ? "" : "none";
        };
        
        const toggleFavoriteRestaurant = function( //
            addFavoriteRestaurantButton, removeFavoriteRestaurantButton, adding) {
            if (!loggedIn) {
                alert("You must be logged in to add a favorite restaurant");
                return; // TODO display better error message
            }
            
            getRestaurant();
            
            if (_restaurant.favorited === adding) {
                const msg = adding
                    ? "You already favorited this restaurant"
                    : "You haven't favorited this restaurant yet";
                alert(msg);
                return; // TODO display better error message, or none at all
            }
            
            const toggleDisplays = function(display) {
                toggleDisplay(addFavoriteRestaurantButton, display);
                toggleDisplay(removeFavoriteRestaurantButton, !display);
                _restaurant.favorited = !display;
            };
            
            // make sure right to start with
            toggleDisplays(adding);
            
            postToServer(adding ? "/add_favorite" : "/remove_favorite", {})
                .then(response => {
                    console.log((adding ? "added" : "removed") + " as favorite", _restaurant);
                })
                .catch(error => {
                    // switch displays back
                    toggleDisplays(adding);
                });
            
            // eagerly switch displays, b/c probably will succeed
            // if not, rollback the switch
            toggleDisplays(!adding);
        };
        
        const toggleFavoriteRestaurantOnClick = function( //
            addFavoriteRestuarantButtonSelector, removeFavoriteRestuarantButtonSelector, adding) {
            (adding ? addFavoriteRestuarantButtonSelector : removeFavoriteRestuarantButtonSelector)
                .click(() => {
                    toggleFavoriteRestaurant(
                        addFavoriteRestuarantButtonSelector[0],
                        removeFavoriteRestuarantButtonSelector[0],
                        adding,
                    );
                });
        };
        
        const main = function() {
            $(() => {
                const zomatoReviewsDiv = $("#zomatoReviews")[0];
                const welpReviewsDiv = $("#welpReviews")[0];
                
                // a bunch of spaces are put there for some reason, this clears them
                $("#newReviewText")[0].value = "";
                
                console.log(welpReviews);
                
                welpReviews.forEach(review => addReview(welpReviewsDiv, review));
                
                const welpRatings = WelpRatingsModule.newWelpRatings().load();
                
                getRestaurant()
                    .then(restaurant => {
                        addRestaurantInfo(restaurant, welpRatings);
                        return restaurant;
                    })
                    .then(restaurant => ZomatoModule.getReviews(restaurant.id))
                    .then(reviews => reviews.user_reviews)
                    .then(reviews => reviews.map(review => review.review))
                    .then(reviews => {
                        console.log(reviews);
                        reviews.forEach(review => addReview(zomatoReviewsDiv, review));
                    });
                
                $("input.star").click(function() {
                    newRating = parseFloat(this.id.substring(5));
                });
                
                $("#addNewReviewButton").click(() => {
                    addNewReview(welpReviewsDiv);
                });
                
                const addFavoriteRestaurantButton = $("#addFavoriteRestaurantButton");
                const removeFavoriteRestaurantButton = $("#removeFavoriteRestaurantButton");
                
                [true, false].forEach(adding => {
                    toggleFavoriteRestaurantOnClick(
                        addFavoriteRestaurantButton, removeFavoriteRestaurantButton, adding);
                });
                
            });
        };
        
        return {
            main: main,
        };
        
    };
    
    const CreateAccountPageModule = function() {
        
        const disableSubmitPasswordsIfNotMatching = function() {
            const password1 = $("#password1");
            const password2 = $("#password2");
            const submitPassword = $("#submitPassword");
            
            const passwordsDontMatchText = newDiv();
            passwordsDontMatchText.innerHTML = "<br><p>Passwords don't match</p>";
            
            const checkPasswordsMatch = function() {
                const match = password1.val() === password2.val();
                submitPassword.attr("disabled", !match);
                
                if (match) {
                    passwordsDontMatchText.remove();
                } else {
                    password2.after(passwordsDontMatchText);
                }
            };
            
            $("#password1, #password2").keyup(checkPasswordsMatch);
        };
        
        const main = function() {
            
            $(() => {
                disableSubmitPasswordsIfNotMatching();
            });
            
        };
        
        return {
            main: main,
        };
        
    };
    
    const ProfilePageModule = function(ZomatoModule, RestaurantSubPageModule) {
        
        const restaurantList = RestaurantSubPageModule.createRestaurantList("No Saved Restaurants");
        
        const addFavoriteRestaurants = function(favoriteRestaurantIds) {
            if (favoriteRestaurantIds.length === 0) {
                restaurantList.addRestaurant(null); // signifies no more restaurants
                return;
            }
            
            favoriteRestaurantIds.forEach((restaurantId, i) => {
                // create element ahead of time and set lazily later
                // this ensures correct order
                restaurantList.addRestaurant({empty: true});
                ZomatoModule.getRestaurant(restaurantId)
                    .then(restaurant => {
                        restaurantList.setRestaurant(i, restaurant);
                    });
            });
        };
        
        // // test, TODO remove later
        // favoriteRestaurantIds.push(16783966, 16775819, 16770116, 18072159);
        
        const main = function() {
            $(() => {
                restaurantList.appendTo($("#restaurants")[0]);
                addFavoriteRestaurants(favoriteRestaurantIds);
            });
        };
        
        return {
            main: main,
        };
        
    };
    
    // for testing
    // const apiKeys = {
    //     zomato: "",
    //     google: {
    //         geocoding: ""
    //     },
    //     getty: undefined,
    // };
    
    const mains = {
        
        "/index": function main(apiKeys) {
            const locationModule = LocationModule(apiKeys.google.geocoding);
            const zomatoModule = ZomatoModule(locationModule, apiKeys.zomato);
            const restaurantImageModule = RestaurantImageModule();
            const restaurantListModule = RestaurantListModule();
            const welpRatingsModule = WelpRatingsModule();
            const restaurantSubPageModule = RestaurantsSubPageModule(
                zomatoModule, restaurantListModule, restaurantImageModule, welpRatingsModule);
            
            const restaurantsPageModule = RestaurantsPageModule(
                locationModule,
                zomatoModule,
                restaurantSubPageModule);
            restaurantsPageModule.main();
            
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
            // test();
        },
        
        // for testing purposes
        "/static/test.html": function main(apiKeys) {
            this["/index"](apiKeys);
        },
        
        "/restaurant_info": function main(apiKeys) {
            const zomatoModule = ZomatoModule(null, apiKeys.zomato);
            const restaurantImageModule = RestaurantImageModule();
            const welpRatingsModule = WelpRatingsModule();
            const restaurantInfoPageModule =
                RestaurantInfoPageModule(zomatoModule, restaurantImageModule, welpRatingsModule);
            restaurantInfoPageModule.main();
        },
        
        "/create_account": function main() {
            const createAccountPageModule = CreateAccountPageModule();
            createAccountPageModule.main();
        },
        
        "/profile": function main(apiKeys) {
            const zomatoModule = ZomatoModule(null, apiKeys.zomato);
            const restaurantListModule = RestaurantListModule();
            const restaurantImageModule = RestaurantImageModule();
            const welpRatingsModule = WelpRatingsModule();
            const restaurantSubPageModule = RestaurantsSubPageModule(
                zomatoModule, restaurantListModule, restaurantImageModule, welpRatingsModule);
            const profilePageModule = ProfilePageModule(zomatoModule, restaurantSubPageModule);
            profilePageModule.main();
        },
        
    };
    
    if (typeof welpPreMain !== "undefined") {
        if ($.isFunction(welpPreMain)) {
            welpPreMain.call(this); // call with this scope
        }
    }
    
    (function main(apiKeys) {
        if (mains.hasOwnProperty(location.pathname)) {
            mains[location.pathname](apiKeys);
        }
    })(apiKeys); // access global apiKeys templated into index.html, or prompt user if undefined
    
})(window);
