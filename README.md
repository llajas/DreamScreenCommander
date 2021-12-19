<img src='https://raw.githubusercontent.com/NeoRame/homebridge-dreamscreen-rm/master/gfx/DreamscreenRM.svg' wight='100%'>
Control your DreamScreen with HomeKit

#
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm version](https://img.shields.io/npm/v/homebridge-dreamscreen-rm?logoColor=white)](https://www.npmjs.com/package/homebridge-dreamscreen-rm)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-dreamscreen-rm)](https://www.npmjs.com/package/homebridge-dreamscreen-rm)
[![License](https://img.shields.io/github/license/neorame/homebridge-dreamscreen-rm)](https://github.com/NeoRame/homebridge-dreamscreen-rm/blob/master/LICENSE)


# Overview

DreamScreen RM is a Homebridge plugin that allows you to control your DreamScreen Ambient TV device with HomeKit.
It featured full control over color of your DS, brightness setting. You can switch to video, music, ambient or sleep mode. It's also possible to activate one of the eight ambient scenes (i didn't add the "random colors" scene for now)

I used a modified version of "genesisfactor" python script (wich is under a MIT Licence) as engine to get this work. Original script can you find here: https://github.com/genesisfactor/DreamScreenCommander


## Installation:


install homebridge: ```npm install -g homebridge```                        
install this plugin: ```npm install -g homebridge-dreamscreen-rm```                    
manually install this plugin: ```sudo npm install -g git+https://github.com/NeoRame/homebridge-dreamscreen-rm.git```                 
go to plugin settings and update your correct ip address of your DreamScreen (can be found in the App under "Update and Reset").

## Using the plugin
You get eight accesoires packed in one tile, seperating them is completely possible

First accesoiry is the led slider, this has two main functions.
* Changing brightness, simply by sliding to an exact percentage.
* Changing color, when you change the color the dreamscreen gets set to ambient mode and will display the set color.

Second accesoiry is the switch, this is used for setting the mode.
* Flipping it on enables video mode / amiblight.
* Flipping it off puts the dreamscreen to sleep mode.

Third accesoiry is the switch, this is used for setting the mode.
* Flipping it on enables ambient mode.
* Flipping it off puts the dreamscreen to video mode.

4th accesoiry is the switch, this is used for setting the mode.
* Flipping it on enables music mode.
* Flipping it off puts the dreamscreen to video mode.

5th accesoiry is the switch, this is used for switch between ambient modes.
* Flipping it on enables Pop Scene.
* Flipping it off puts the dreamscreen to Forrest Scene.

6th accesoiry is the switch, this is used for switch between ambient modes.
* Flipping it on enables July 4th Scene.
* Flipping it off puts the dreamscreen to Holiday Scene.

7th accesoiry is the switch, this is used for switch between ambient modes.
* Flipping it on enables Ocean Scene.
* Flipping it off puts the dreamscreen to Rainbow Scene.

8th accesoiry is the switch, this is used for switch between ambient modes.
* Flipping it on enables Twinkle Scene.
* Flipping it off puts the dreamscreen to Fireside Scene.



# For advanced Users ONLY!!!

you can use the DreamScreenComander.py standalone on PC for example, for this look at the Original description:

# DreamScreenCommander
**Overview**

Python script that allows you to locally integrate control your DreamScreen Ambient TV device with other systems.

Consider this is a backend service script.  You will need some sort of local front end for yourself, like Openhab, Window Speech Marcos, a Harmony remote control, keyboard marcos, or some event based scripts

While this can be used in many ways where you can have your computer call the script upon events and programatically enter the option values.

My solution will be with a Raspberry Pi, a FLIRC, and a Harmony remote.  Got tired of having to whip out my phone just to change a setting when my remote was right there... :)

This was one of my weekend projects (1/13/18 - 1/14/18).  I hope this helps someone else.  Stay tuned for others!

**How to use the script:**

**python \<path-to-this-file> \<option> \<value>**

For Windows users, it will be **\<path-to-python.exe> \<path-to-this-file> \<option> \<value>**

- Show Help screen                  **-h**
- Temporarily setting IP address:   **-i \<ip address>**
- Choose Group:                     **-g \<number>**
- Changing Modes:                   **-m \<number>**
- Changing Brightness:              **-b \<number>**
- Changing Sources:                 **-s \<number>**
- Changing Scenes:                  **-a \<number>**
- Changing Color:                   **-c \<0-255 0-255 0-255>**

**Example: "python dreamscreen.py -i <ip address> -g 0 -m 0"** will turn off the dreamscreen

Options **should** be able to be daisy chained.  E.G, if you have more than one DreamScreen, you can temporarily specify which one to talk to.  This is a feature of the way it was written, and there aren't too many other options to be daisy chained...soooo...take it with a grain of salt?

**Example: "python dreamscreen.py -i 192.168.1.2 -g 0 -m 0"** **should** turn off that particular dreamscreen (untested as I only have one Dream screen)

**Ideas for usage**

- Automatically adjust Dreamscreen brightness based on room ambient brightness
- Control your Dreamscreen inputs with a Harmony remote control - no phone needed!
- Use Dreamscreen as a light with with your smart home instance and a raspberry pi (full features coming soon)
- Do Voice UI (Alexa-styled) control of the Dreamscreen (Windows Speech Marcos, Jasper)
- Automate with your android phone SL4A and Tasker(the script should work there too as it only imports sys, socket, optparse, and time)

**What works**
- Changing Modes
- Changing Brightness
- Changing Inputs
- Changing Scenes
- Changing Groups
- Changing Color
