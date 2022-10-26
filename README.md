# o!rdr-client

The client used to render videos at https://ordr.issou.best.

Modifying the source code to use with the official o!rdr server will lead to a ban.

## What does this do?

o!rdr is a free and easy-to-use API/website that allows you to render osu! videos of replays using danser (https://github.com/Wieku/danser-go).

This is the client used to render the videos for o!rdr.

Anyone with this client can contribute and render osu! videos for API and website users of o!rdr.

Please join the [o!rdr Discord server](https://discord.com/invite/vJpskzepCZ) if you want to apply or get more informations about the client.

## How to use

### Run from source

NodeJS v14.14.0+ is required.

You can find FFmpeg builds [here](https://github.com/BtbN/FFmpeg-Builds/releases/tag/latest), download win64-gpl if you're on Windows and linux64-gpl on linux, the versions without the "shared" in the file name.

1. Clone the repository
2. Copy FFmpeg binaries to files/danser IF you do not have it installed system-wide (create the directory if it does not exist)
3. Run 'npm install' at the root folder of o!rdr-client.
4. Run 'node main.js' to launch o!rdr-client and follow the instructions. danser will be downloaded automatically.

### Run from a build (no auto-update)

1. Download the latest release
2. Copy it in a dedicated folder for the client
3. Copy FFmpeg binaries to files/danser IF you do not have it installed system-wide (create the directories)
4. Run the client by double-clicking on it (not recommended as it will close itself on crash) or via the terminal

## Config

-   encoder: can be "nvidia" (NVENC), "amd" (VCE), "intel" (QSV) or "cpu" (libx264).
-   motionBlurCapable: set this to true to get renders with motion blur.
-   usingOsuApi: set this to true to get renders that need a scoreboard and that therefore needs to fetch data from the osu! api (leaderboard). Set an osu! api key in osuApiKey to use this.
-   debugLogs: print more logs when disconnected from the o!rdr server.
-   deleteRenderedVideos: automatically delete rendered videos from your drive once they have been successfully sent to the o!rdr server.
-   renderOnInactivityOnly: connect to the o!rdr server once the computer is idle (check every 60 seconds if mouse or keyboard hasn't been touched for 30 seconds). To use this, you need to install the desktop-idle package with "npm install --save desktop-idle". On Windows, it needs Python and VS > 2016 to compile what it needs to work correctly. Check [this](https://github.com/bithavoc/node-desktop-idle) for more informations about this package. Won't work on precompiled builds for the moment.
-   customSongsFolderPath: use a custom path to store songs downloaded instead of the default (files/danser/Songs). Can be useful if you want new maps on osu! for example.
-   logTimestamps: add a timestamp before every log line.
-   customization: (to use with the official o!rdr instance only) with textColor and backgroundType - change the way your renderer name looks on the website! Changes made to this field are hotswappable and changes are effective almost instantly.

Available options for textColor: `salmon`, `azure`, `emerald`, `pear`, `pumpkin`, `red`, `teal-blue`, `cream`, `silver-coin`, `botany`, `calm-gold`, `limestone`, `alpine-morning-blue`, `transluscent-white`, `yellow-orange`, `algae-green`. Empty string for default white.

Available options for backgroundType: from 0 (none) to 6 included.

## Build

With pkg, you can build this client pretty easily. To do so, ensure you have pkg installed and run it at the root of the client source code folder with `pkg main.js`.

You can then reduce the binary filesize using gzexe on Linux. No solutions on compressing the binary on Windows have been researched, though you could package the client with Nexe and then compress with UPX (not tested on Windows, but works on Linux). UPX or strip does not work with pkg.
