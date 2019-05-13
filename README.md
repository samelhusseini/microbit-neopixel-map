# micro:bit Traffic Map

There are three main components in this system. A script that collects data and sends it over serial in chunks. A micro:bit that receives the packets over serial and relays them over radio, and another micro:bit that receives the packets over radio and writes the values to the connected Neopixels.

## Install

Run ``yarn`` to install dependencies and build the Typescript sources.

## Configuration

Get an API key from the WSDot service at [https://www.wsdot.com/traffic/api/](https://www.wsdot.com/traffic/api/)

Configure the API key in ``src/config.ts``

## Compile

Compile the changes made to ``src/config.ts`` by running ``yarn compile``.

## Run


### Step 1: Flash the micro:bits

Begin by flashing the two micro:bits (transmitter and receiver). You'll find the hex files for each under ``microbit``. The radio group chosen here is group ``152``.

### Step 2: Find the micro:bit USB port

In order to find the micro:bit USB port, connect the transmitting micro:bit to the machine this script will run on and call ``yarn find``. 

This will list all the available ports, look for the one that says ``MBED``.
Copy that port, we'll need it for the next step. 
On Mac this will be in the format of ``/dev/tty.usbmodemXXXX``, on Windows that will be ``COMXX``.

### Step 3: Run the script

Run the script that collects data from WSDot and sends it over serial. The script expects the port of the connected micro:bit as the first parameter.

``yarn start``


