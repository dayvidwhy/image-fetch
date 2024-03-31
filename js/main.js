"use strict";

var loader = (function () {
    var loadingMessage = document.getElementById("image-loading-message");

    return {
        message (message) {
            loadingMessage.style.display = "block";
            loadingMessage.innerHTML = message;
        },
        hide () {
            loadingMessage.style.display = "none";
        }
    }
})();

function getSearchUrl () {
    var input = document.getElementById("input").value;

    // sub search
    if (document.querySelectorAll("select option")[0].selected === true) {
        // break up the search into an array of subreddits
        var search = input.trim().replace(/\s\s+/g, " ").split(" ").join("");
        return "https://www.reddit.com/r/" + search + ".json" + (imageStore.getNextImages());
    } else {
        // user stuff
        return "https://www.reddit.com/user/" + input + "/submitted.json" + (imageStore.getNextImages());
    }
}

// Depending on the content hosting site, extract the main content URL
function getContentInfo (element) {
    // check if it has a video preview
    if (element.data.preview.reddit_video_preview !== undefined) {
        return {
            contentUrl: replaceHTMLEscape(element.data.preview.reddit_video_preview.fallback_url),
            contentType: "video"
        }
    }

    if (element.data.url.indexOf(".gif") >= 0) {
        // It's an imgur hosted resource
        if (element.data.domain === "i.imgur.com") {
            return {
                contentUrl: element.data.url,
                contentType: "image"
            };
        }
        // i.redd.it hosted resource
        if (element.data.domain === "i.redd.it") {
            return {
                contentUrl: replaceHTMLEscape(element.data.preview.images[0].variants.mp4.source.url),
                contentType: "video"
            };
        }
    }

    return {
        contentUrl: replaceHTMLEscape(element.data.preview.images[0].source.url),
        contentType: "image"
    };
}

// Initiate our Reddit request
function fetchRedditImages () {
    loader.message("Loading...");
    fetch(getSearchUrl())
        .then(function (response) {
            if (response.status === 302 || response.status === 404) {
                throw new Error();
            }
            var contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            }
            throw new Error();
        })
        .then(function (images) {
            if (images.data.children.length === 0) {
                return loader.message("No Results");
            }
            imageStore.setNextImages(images.data.after);
            imageStore.insertImages(images.data);
            loader.hide()

            // cheap way to see if we filled the current view with images
            // ideally track if all pulled images load, then test height
            setTimeout(function () {
                if (scroller.testHeight()) {
                    scroller.disableScroller();
                    fetchRedditImages();
                } else {
                    scroller.enableScroller();
                }
            }, 1000);
        }).catch(function () {
            return loader.message("Something went wrong, try refreshing.");
        });
}

// Takes a string and replaces HTML escaped &
function replaceHTMLEscape (string) {
    return string.split("&amp;").join("&");
}

// When our JSON successfully loads parse it and render images on the page.
var imageStore = (function () {
    var currentRow = document.createElement("div");
    currentRow.className = "row";
    var imageCounter = 0;
    var imagesPerRow = 4;
    var output = document.getElementById("output");
    var nextImages;

    return {
        clearImages () {
            currentRow = document.createElement("div");
            currentRow.className = "row";
            imageCounter = 0;
            nextImages = undefined;
            output.innerHTML = "";
            return true;
        },
        setNextImages (next) {
            nextImages = next;
        },
        getNextImages () {
            return nextImages ? "?after=" + nextImages : "";
        },
        insertImages (data) {       
            for (var i = 0; i < data.children.length; i++) {
                // check for a full row
                if (imageCounter === imagesPerRow) {
                    output.appendChild(currentRow);

                    imageCounter = 0;

                    currentRow = document.createElement("div");
                    currentRow.className = "row";
                }

                var element = data.children[i];

                // should we use this image?
                if (!element.data.preview || element.data.over_18) continue;

                var currentImages = element.data.preview.images[0];

                // If the resolutions array is empty just skip the image
                if (currentImages.resolutions.length === 0) continue;

                // title of the image
                var titleText = element.data.title;

                // Work out image aspect, pick something from the middle of the array
                var currentResolutions = currentImages.resolutions;
                var largeResolution = currentResolutions[Math.floor(currentResolutions.length - 1 / 2)];
                var aspect = largeResolution.width / largeResolution.height;

                // create the image
                var image = new Image();
                image.src = replaceHTMLEscape(currentImages.resolutions[0].url);
                image.className = "image-loading";
                image.alt = titleText;

                /*
                * When the small image loads change its source to the larger image.
                * This will cause a network request to start and the user can view the
                * blurry small image until it's done.
                */
                image.onload = (function (_image, _largeResolution) {
                    return function () {
                        _image.src = replaceHTMLEscape(_largeResolution);
                        _image.onload = function () {
                            this.className = "";

                            // when the larger version loads, apply the zoom effect
                            this.parentElement.className += " image-zoom";

                            // Clicking the image shows the overlay
                            this.parentElement.onclick = function () {
                                overlay.displayContent(this);
                            }
                        };
                    };
                })(image, largeResolution.url);

                // if it fails to load delete the element
                image.onerror = function () {
                    this.outerHTML = "";
                }

                // build the container
                var container = document.createElement("div");
                container.className = "image-container";
                // let's our images be tiled
                container.style.flex = aspect;
                // set the large image for our overlay
                var contentInfo = getContentInfo(element);
                container.setAttribute("content-type", contentInfo.contentType);
                container.setAttribute("large-image", contentInfo.contentUrl);
                container.setAttribute("regular-image", replaceHTMLEscape(largeResolution.url));
                container.setAttribute("title-text", titleText);
                container.setAttribute("author", element.data.author);
                container.appendChild(image);

                // adds the title to the overlay
                var title = document.createElement("p");
                if (titleText.length > 25) {
                    titleText = titleText.substring(0, 24) + "...";
                }
                title.innerHTML = titleText;
                title.className = "image-title";

                // add to the page
                container.appendChild(title);
                currentRow.appendChild(container);

                // increment our image counter
                imageCounter++;
            }
        }
    };
})();

var scroller = (function () {
    var debounceTimer = null;

    // have we scrolled to the end of the page?
    function _testHeight () {
        return window.scrollY + window.innerHeight >= (document.body.scrollHeight - 400);
    }

    // Have scrolled far enough down the page?
    function testScrollHeight () {
        if (_testHeight()) {
            scroller.disableScroller();
            fetchRedditImages();
        }
    }

    function scrollLoad () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(testScrollHeight, 100);
    }

    return {
        enableScroller () {
            document.addEventListener("scroll", scrollLoad);
        },
        disableScroller () {
            document.removeEventListener("scroll", scrollLoad);
        },
        testHeight () {
            return _testHeight();
        }
    }
})();

// direction buttons
var directionals = (function () {
    var currentContainer;

    // they pressed an arrow key maybe
    function directionPress (e) {
        var newElement, newRow, sibling, child;
        var key = e.which || e.keyCode;

        // exit early if not left or right
        if (key !== 37 && key !== 39) return;

        // which key?
        if (key === 37) {
            // hit left
            sibling = "previousSibling";
            child = "lastChild";
        } else if (key === 39) {
            // pressed right
            sibling = "nextSibling";
            child = "firstChild";
        }

        newElement = currentContainer[sibling];
        if (newElement) {
            // found next element right away
            currentContainer = newElement;
            overlay.displayContent(currentContainer);
        } else {
            // we need to go up and into the previous row
            newRow = currentContainer.parentElement[sibling];
            if (newRow) {
                currentContainer = newRow[child];
                overlay.displayContent(currentContainer);
            }
        }
    }

    return {
        bindArrowKeys () {
            document.addEventListener("keydown", directionPress);
        },
        unbindArrowKeys () {
            document.removeEventListener("keydown", directionPress);
        },
        setCurrentContainer (container) {
            currentContainer = container;
        }
    }
})();

// our overlay component
var overlay = (function () {
    var userButton = document.getElementById("overlay-user");
    var overlayContainer = document.getElementById("overlay");
    var overlayTitle = document.getElementById("overlay-title");
    var overlayImage = document.getElementById("overlay-image");
    var overlayVideo = document.getElementById("overlay-video");

    // setup overlay handler for closing
    overlayContainer.onclick = function() {
        this.style.display = "none";

        // let body scroll again
        document.body.style.overflow = "";
        directionals.unbindArrowKeys();
    };

    return {
        // For the overlay element, extract it's data attributes.
        displayContent (content) {
            // enable arrow navigation
            directionals.bindArrowKeys();
            directionals.setCurrentContainer(content);

            // display the overlay
            overlayContainer.style.display = "block";

            // set overlay properties
            overlayTitle.innerHTML = content.getAttribute("title-text");
            if (content.getAttribute("content-type") === "video") { // vid
                overlayVideo.alt = content.getAttribute("title-text");
                overlayVideo.src = content.getAttribute("large-image");
                overlayVideo.poster = content.getAttribute("regular-image");

                overlayVideo.style.display = "block";
                overlayImage.style.display = "none";
            } else { // img
                overlayImage.alt = content.getAttribute("title-text");
                overlayImage.src = content.getAttribute("regular-image");
                overlayVideo.style.display = "none";
                overlayImage.style.display = "block";
                overlayImage.onload = (function (_content) {
                    return function () {
                        overlayImage.src = _content.getAttribute("large-image");
                    }
                })(content);
            }

            // set author on the overlay button
            var author = content.getAttribute("author");
            userButton.setAttribute("author", author);
            userButton.innerHTML = "By /user/" + author;

            // don't let body scroll
            document.body.style.overflow = "hidden"; 
        }
    }
})();

// Checks the input field after enter is hit or search button clicked
function validateInputs (inputField) {
    // work out the input value
    var sub = inputField.value;
    if (document.querySelectorAll("select option")[1].selected === true && sub.indexOf(" ") >= 0) {
        inputField.placeholder = "Users can't have spaces.";
        inputField.value = "";
        return false;
    }
    if (sub.length === 0) {
        inputField.placeholder = "Please search for something.";
        return false;
    }
    return true;
}

// apply event listeners
function bindListeners () {
    var inputField = document.getElementById("input");

    // when users type into the search bar again, clear the current search
    inputField.addEventListener("keypress", imageStore.clearImages);

    // clicking the search button
    document.getElementById("input-search").addEventListener("submit", function (e) {
        e.preventDefault();
        validateInputs(inputField) && imageStore.clearImages() && fetchRedditImages();
    });

    // clicking the users name in the overlay for search
    document.getElementById("overlay-user").addEventListener("click", function (e) {
        document.querySelectorAll("select option")[1].selected = true;
        inputField.value = document.getElementById("overlay-user").getAttribute("author");
        imageStore.clearImages();
        fetchRedditImages();
    });

    document.getElementsByClassName("theme-button")[0].addEventListener("click", function (e) {
        if (document.body.className === "light") {
            document.body.className = "dark";
        } else {
            document.body.className = "light";
        }
    });
}

// polyfill fetch if required
(function initialise () {
    if (window.fetch) {
        bindListeners();
    } else {
        var fetchPoly = document.createElement("script");
        fetchPoly.src = "https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.1/fetch.min.js";
        fetchPoly.onload = bindListeners;
        document.head.appendChild(fetchPoly);
    }
})();
