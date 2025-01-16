# SC4

`sc4` is a command line utility for modifying SimCity 4 savegames and automating various modding tasks.
 
## Installation

There are two ways to install `sc4`.
Binaries are available [for Windows and Linux](https://github.com/sebamarynissen/sc4/releases/latest).
Just put the `sc4.exe` (or `sc4` if you're on Linux) somewhere on your filesystem and you're good to go.

If you want to use the commands in `sc4` - see [Usage](#usage) for more info - then it's advisable to add the folder where you stored the `sc4.exe` to your `PATH` variable on Windows.
That way, the `sc4` command will always be available if you open a command prompt in a folder.

You can also install `sc4` with [Node.js](https://www.nodejs.org).
Make sure to download the latest version of Node.js, as `sc4` only works with Node.js `22.3` or higher.

Once Node.js is installed, fire up a command prompt, type `npm install -g sc4` and hit enter.
This will globally install the sc4 module and make the `sc4` command available in your command line.
In order to ensure that `sc4` is installed correctly, run `where sc4`.
If it finds the sc4.cmd file, then you're good to go and can run all commands using `sc4 [command]`.

## Usage

There are two ways to use `sc4`.
The easiest one is to use it in interactive mode, which is the default when you either open `sc4.exe`, or run `sc4` via the command line.
When doing this, you will be prompted with what you want to do.
Currently you can perform the following actions in interactive mode:

 - **Growify RCI** It was long thought that plopped residentials could not be used because the residents could never find any jobs, and hence the buildings would always eventually abandon. However, by modifying the savegame, it is possible to trick SimCity 4 into thinking that they were actually grown. This process is called *growifying* the buildings, and it can be used for commercial or industrial buildings as well. For more info, see [this thread](https://community.simtropolis.com/forums/topic/758258-modifying-sc4-savegames-it-is-possible/) on Simtropolis.
 - **Make buildings historical** Marking a lot of buildings in a city historical is tedious and time consuming. You can use `sc4` to automatically mark all lots in a city as historical.
 - **Create an optimal pipe layout** Draws pipes in a city in an optimal way, meaning it covers the entire city for minimal cost. Note that this removes any existing piping network!
 - **Add lots to a submenu** [@memo](https://github.com/memo33) has released an [excellent DLL mod](https://community.simtropolis.com/files/file/36142-submenus-dll/) that adds a submenu system to the game. However, in order to add existing content to a certain submenu, you often need to edit the content yourself in iLives Reader. This action makes it easier to add a bunch of lots to a certain submenu.
 - **Create a new submenu** You can use this to add a custom submenu to the game, which basically automates [this flow](https://github.com/memo33/submenus-dll?tab=readme-ov-file#creating-a-new-submenu-button). You will be prompted to specify an image as icon, with the option to automatically apply [this icon template](https://github.com/memo33/submenus-dll/releases/download/1.0.0/memo-icon-template-0.2.xcf).
 - **Scan plugins for submenus** This action can be used to scan a certain folder - which defaults to your configured plugins folder - for existing submenus. Any submenus that are found which are not present in your config yet will be stored in the config and hence be available from then on to be used when adding lots to a certain submenu.
 - **Change a menu icon** This action can be used to change the icon for a menu item. This works for lots, but also for submenus that have been generated with the command above. As with most actions, you can drag & drop a `.sc4lot` or `.dat` file on the exe to automatically select it.
 - **Track dependencies** This action is used for listing the dependencies of a certain file or folder. The action is aware of packages that were installed by [sc4pac](https://memo33.github.io/sc4pac/#/), which means that it will first list all dependencies as sc4pac packages. If a dependency was not installed with sc4pac, the file it can be found in is listed instead.
 - **Plop all lots of a collection** This action can be used to plop all lots contained in a set of files. This is highly experimental and **MUST NOT** be used in established cities. It is meant to ensure you have all required dependencies installed for the set of lots because it allows you to verify no brown boxes are present.

The tool has been designed in a way that if you drag & drop files on the `sc4.exe` binary and then run on of the actions above, it is automatically assumed that you want to modify the files you drag & dropped.
This becomes especially powerful for cities if you combine it with configuring Windows to open all `.sc4` files with the `sc4.exe`.
As such you can simply double-click one of your cities, and subsequently it will fire up the interactive interface and ask you what you want to do with that city.

### Advanced usage

If you are an advanced user and you have some experience with cli tools, then there is also the option to use `sc4` by running one of its commands directly.
Run `sc4 --help` in a command prompt to get an overview of all available commands.
Beware that certain actions that a typical end-user would not regularly use are not available in interactive mode!

Note that since v0.2.0, the commands have been grouped with subcommands.
For example, the old `sc4 growify <city>` command can now be used as `sc4 city growify <city>`, and `sc4 plop-all <city>` is now `sc4 city plop`.

```
Usage: sc4 [options] [command]

sc4 is a cli utility to modify .sc4 savegames and perform various modding tasks.
You can use the individual commands listed below, or just run sc4 without any commands to get an interactive interface.
Run sc4 [command] --help to view all options for the individual commands.

Options:
  -V, --version  output the version number
  -h, --help     display help for command

Commands:
  city           Modify savegames. Run sc4 city to view all available commands
  submenu        Manage submenus. Run sc4 submenu to list available commands
  plugins        Manage plugins. Run sc4 plugins to list available commands
  misc           Contains various commands that are experimental and not officially supported. Be very careful when using them!
  config         Manage sc4 configuration. Run sc4 config to list available commands
```

You can run `sc4 [command] --help` to get an overview of the options for every command.
For example, if you run `sc4 city growify --help` you'll see
```
Usage: sc4 city growify [options] <city>

Convert plopped buildings into functional growables

Options:
  -o, --output <out>        The output path to store the city. Overrides the file by default
  -r, --residential <type>  Zone type of the residential buildings to growify (Low, Medium, High)
  -c, --commercial <type>   Zone type of the commercial buildings to growify (Low, Medium, High)
  -i, --industrial <type>   Zone type of the industrial buildings to growify (Medium, High)
  -g, --agricultural        Whether or not to growify agricultural buildings as well
  --no-historical           Don't make the growified lots historical
  -h, --help                display help for command
```

which can be used for example as
```
sc4 city growify -r Low -c High --no-historical "City - Plopped city.sc4"
```

## Backups

While this tool has been thoroughly tested, modifying Savegames is still a brittle process where there is always the risk that your files become corrupted.
Therefore I advise you to **always have sufficient backups of any files you want to modify**! I am **not** liable for the consequences if your savegame becomes corrupted and you lose your entire city if you did not have a recent backup of it!

As a safety measure, whenever `sc4` is about to overwrite a file, it will create a backup of the file inside your `AppData/Local/Temp` folder.
Look for the folders that start with `sc4cli_*` and use the added timestamp to find your uncorrupted files again.
The backup is not kept indefinitely, so if you notice that your file has been corrupted, make sure to immediately go looking for it in the folder specified above.

## DISCLAIMER

Allthough this tool has been thorougly tested and keeps backups of any files it modifies, use of it **IS AT YOUR OWN RISK**. **ALWAYS MAKE SURE TO HAVE SUFFICIENT BACKUPS OF ANY FILES YOU WANT TO MODIFY. I AM NOT LIABLE FOR THE CONSEQUENCES IF SOMETHING GOES WRONG**.

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
