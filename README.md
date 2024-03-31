# RedFetch

I made this as a way of understanding the [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API) and loading images after initially loading a thumbnail image.

## Installation
```bash
git clone git@github.com:dayvidwhy/redfetch.git
cd redfetch
open index.html
```

This project does not use any build tools, it is just HTML, CSS and JavaScript, so you just have to open the included HTML file and the project will load.

## About
There are other reddit image viewers out there that offer more functionality, but I found that all I wanted to do was browse through the images, so I made something that does just that. 

It seems faster than other sites so far and performs well on mobile.

I also make use of debouncing to prevent browser lag when the page is scrolled and scrolling to the bottom allows for more images to be loaded.

## Contributing
Feel free to make an issue with a suggested feature you might like.

Please note that I intend to keep this application light weight and login based operations may not be supported at all in the future.

## Licence
See the file `LICENSE` in the repository root directory.
