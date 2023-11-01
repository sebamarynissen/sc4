<span style="color: maroon">**WARNING! THIS TOOL IS EXPERIMENTAL AND MEANT FOR PERSONAL USE. USE AT OWN RISK AND ALWAYS HAVE A BACKUP OF ANY FILES YOU WANT TO MODIFY. I AM NOT LIABLE FOR THE CONSEQUENCES IF SOMETHING GOES WRONG.**</span>

# SC4

`sc4` is a command line utility for automating SimCity 4 modding and modifying SimCity 4 savegames.
 
## Installation
 
In order to use the `sc4` command, you will need to install [node.js](https://www.nodejs.org).
Node.js 12 or higher is required, so choose the one with the latest features, otherwise it won't work!

Once node.js is installed, fire up a command prompt, type `npm install -g sc4` and hit enter.
This will globally install the sc4 module and make the `sc4` command available in your command line.
In order to ensure that `sc4` is installed correctly, run `where sc4`.
If it finds the sc4.cmd file, then you're good to go and can run all commands using `sc4 [name-of-the-command]`.
In order to list all available options per command, run `sc4 [name-of-the-command] --help`.

## Usage

Currently the following commands are included. Run `sc4 --help` to list all available commands.

 - `historical [city]` This will mark lots in the given city (given as relative path to an .sc4 savegame file) as historical.
 - `growify [city]` This will turn plopped residential and/or industrial lots in the given city into growables so that no more No Job Zots will appear and the Sims can find a way to work. Example usage (when I'm in the folder of the region)
 ```
 sc4 growify "City - City name.sc4"
 ```
 -  `tileset [options] [dir]`      Set the tilesets for all buildings in the given directory. Use `--block` to remove the building from all tilesets and hence block its growth, or use `--chicago`, `--ny`, `--houston` or `--euro`
 -  `backup [options]`             Backup a region or your entire plugins folder
 -  `dump <city>`                  Give a human-readable representation of all lots in the city
 -  `refs [options] <city>`        Finds internal memory references within a city
 -  `pointer <city> <pointer>`     Finds the subfile entery addressed by the given pointer
 -  `tracts [options] <city>`      Changes the active tilesets in the given city
 -  `pipes [options] <city>`      Create the optimal pipe layout in the given city

## License

 MIT License

Copyright (c) 2019-present Sebastiaan Marynissen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
