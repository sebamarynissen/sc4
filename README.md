**WARNING! THIS TOOL IS EXPERIMENTAL AND MEANT FOR PERSONAL USE. USE AT OWN RISK AND ALWAYS HAVE A BACKUP OF ANY FILES YOU WANT TO MODIFY. I AM NOT LIABLE FOR THE CONSEQUENCES IF SOMETHING GOES WRONG.**

# SC4

`sc4` is a command line utility for automating SimCity 4 modding and modifying SimCity 4 savegames. Run `sc4 --help` to list all available commands.
Currently the following commands are included:

 - `historical [city]` This will mark *all* lots in the given city (given as relative path to an .sc4 savegame file) as historical.
 
 ## Installation
 
In order to use the `sc4` command, you will need to install [node.js](https://www.nodejs.org).
As this module was developed using node 12, it's best to download and install 12 or higher.

`sc4` also uses [Native Node Modules](https://nodejs.org/api/addons.html).
These are C++ libraries that are used by tool and will still need to be compiled.
In order to be able to do this on Windows you will need to install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools).
This can be done by opening a command prompt and typing `npm install --global windows-build-tools`.
On Windows 7 you will also need to download & install [.NET Framework 4.5.1](http://www.microsoft.com/en-us/download/details.aspx?id=40773).

Usually node.js packages are installed using node's package manager `npm`.
This package however is not yet available on npm as it is still in a pre-alpha state.
It probably will be available via npm later on.
Hence currently you will need to clone this git repository.
If you already have git installed, you can clone the repository using `git clone https://github.com/sebamarynissen/sc4`.
Otherwise, you can simply download the repository as a [.zip file](https://github.com/sebamarynissen/sc4/archive/master.zip) and unzip it somewhere on your computer.

Once you have cloned the repository (either using `git` or as a zip), navigate to the folder and open up a command prompt.
In Windows this can be done easily by clicking in the Windows Explorer Adress bar, typing "cmd" and then hitting enter.
This should open up a command prompt.
Make sure that your current working directory is the directory of the cloned repository!

Having opened the command prompt, type `npm install` and hit enter.
This will install all node.js modules that are used by the tool and will also compile the native C++ addons if you installed Windows Build Tools correctly.

In order to make the `sc4` command available, you will still need to *link* the module.
To do this, open up again a command prompt in the root directory of the repository and type `npm link`.
If you now type `where sc4` you should see the location of the sc4.cmd file.
This means that everything is installed correctly.
Try it by running `sc4 --help` from any command prompt.

You can now run all commands by running `sc4 [name-of-the-command]`.
In order to list available options per command, run `sc4 [name-of-the-command] --help`.
