# o!rdr client

The client used to render videos at https://ordr.issou.best.

Modifying the source code to use with the official o!rdr server will lead to a ban.

## What does this do?

o!rdr is a free and easy-to-use API/website that allows you to render osu! videos of replays using danser (https://github.com/Wieku/danser-go).

This is the client used to render the videos for o!rdr.

Anyone with this client can contribute and render osu! videos for API and website users of o!rdr.

Please join the [o!rdr Discord server](https://discord.com/invite/vJpskzepCZ) if you want to apply or get more informations about the client.

## How to use

### Run from source

NodeJS v22+ is required.

1. Clone the repository
2. Run 'npm install' at the root folder of the o!rdr client
3. Run 'npm start' to launch it
4. Follow the instructions, dependencies like danser will be downloaded automatically

### Run from a build (no auto-update)

1. Download the latest release
2. Copy it in a dedicated folder for the o!rdr client
3. Run the client by double-clicking on the downloaded executable (not recommended as it will close itself on crash) or via the terminal
4. Follow the instructions, dependencies like danser will be downloaded automatically

### Run a benchmark only

When running the client from source, run `npm run benchmark` to only perform a benchmark.

When running the client with an executable, run it via the terminal using the benchmark argument `--benchmark`.

## Config

-   `encoder`: can be "cpu", "nvenc" (for NVIDIA GPUs), "qsv" (for Intel GPUs)
-   `capabilities`: enable or disable capabilities to the client. If your computer is performant enough, you can enable the `danser.motion_blur` and `danser.uhd` to receive render jobs with motion blur or 4K resolution
-   `debug`: log more things to the terminal
-   `discord_presence`: use the discord rich presence or not
-   `auth`: auth keys of external services that can be used by the client, such as the osu! API to receive renders requiring showing a scoreboard and therefore needs to fetch data from the osu! API (v2).
-   `customization`: change the way your renderer name looks on the website! Changes made to this field are hotswappable and changes are effective almost instantly

Available options for customization text_color: `salmon`, `azure`, `emerald`, `pear`, `pumpkin`, `red`, `teal-blue`, `cream`, `silver-coin`, `botany`, `calm-gold`, `limestone`, `alpine-morning-blue`, `transluscent-white`, `yellow-orange`, `algae-green`. Empty string for default white.

Available options for customization background_type: from 0 (none) to 6 included.
