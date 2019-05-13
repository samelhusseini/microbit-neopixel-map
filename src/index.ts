import * as SerialPort from 'serialport';
import TravelerInfoClient from "wsdot-traveler-info";

import * as CONFIG from './config';

if (process.argv.length < 3) {
    console.error('Expected micro:bit port as an argument. \nRun `yarn find` to find the USB port the micro:bit is connected to.');
    process.exit(0);
}

const apiKey = CONFIG.API_KEY;
const microbitPort = process.argv[2]; //eg: '/dev/tty.usbmodem1422';
const client = new TravelerInfoClient(apiKey);

interface Map<T> {
    [key: string]: T;
}

interface RoadMeta {
    minMile?: number;
    maxMile?: number;
    pixels?: number;
    directions?: string[];
}

interface RoadData {
    mile?: number;
    value?: number;
}

const SEGMENT_SIZE = 16;
const NUM_OF_ROADS = 4;

const roadsWeCareAbout: Map<RoadMeta> = {
    '005': {
        minMile: 156.08,
        maxMile: 174.60,
        pixels: 71,
        directions: ['NB', 'SB']
    },
    '405': {
        minMile: 3.9,
        maxMile: 22,
        pixels: 71,
        directions: ['NB', 'SB']
    },
    '520': {
        minMile: 0,
        maxMile: 7.70,
        pixels: 32,
        directions: ['EB', 'WB']
    },
    '090': {
        minMile: 0,
        maxMile: 10.90,
        pixels: 32,
        directions: ['EB', 'WB']
    }
}

// Start the serial connection to the microbit
const port = new SerialPort(microbitPort, {
    baudRate: 115200,
    autoOpen: false
});

port.open(() => {
    console.log("Port open");
    begin();
});


let roads: number[][] = [];

let segmentHash: Map<string> = {};

function initializeRoad(road: number, direction: number, size: number) {
    let key = road + (direction ? NUM_OF_ROADS : 0);
    if (!roads[key]) roads[key] = [];
    for (let i = 0; i < size; i++) {
        roads[key].push(0);
    }
}

// 005
initializeRoad(2, 0, 71);
initializeRoad(2, 1, 71);

// 405
initializeRoad(0, 0, 71);
initializeRoad(0, 1, 71);

// 520
initializeRoad(1, 0, 32);
initializeRoad(1, 1, 32);

// 090
initializeRoad(3, 0, 32);
initializeRoad(3, 1, 32);

// Method to transmit data

function transmitSegment(segment: string, ms: number) {
    setTimeout(function () {
        console.log('sending: ', segment);
        port.write(segment + "\n");
    }, ms)
}

let ms = 0;

function maybeTransmitSegment(road: number, direction: number, part: number, values: string) {
    let key = `${road}${direction}${part}`;
    let segment = `${road}${direction}${part}${values}`;
    //segment = `${road}${direction}${part}4444444444444444`;

    if (segmentHash[key] == segment) return;
    transmitSegment(segment, ms);
    ms += 1000;
    segmentHash[key] = segment;
}

function begin() {
    // First call to get data when we start.
    getData();

    // Call service for latest data to renew
    setInterval(function () {
        getData();
    }, 30 * 1000); // Every 30 seconds, maybe a minute

    // Invalidate all data anyway every 10 seconds
    setInterval(function () {
        segmentHash = {};
    }, 5 * 60 * 1000); // 5 minutes
}

function getData() {

    console.log("Pinging WSDot service");

    client.getTrafficFlows().then(
        function (flows) {
            let hash: Map<Map<RoadData[]>> = {};

            for (let i = 0; i < flows.length; i++) {
                const point = flows[i];
                const roadName = point.FlowStationLocation.RoadName;
                const direction = point.FlowStationLocation.Direction;
                const pointValue = point.FlowReadingValue;

                // Filter roads we don't care about;
                const roadMeta = roadsWeCareAbout[roadName];
                if (!roadMeta) continue;

                const milemarker = point.FlowStationLocation.MilePost;
                if (milemarker > roadMeta.maxMile || milemarker < roadMeta.minMile) continue;

                // const roadDirection = direction == 'NB' || direction == 

                if (!hash[roadName]) hash[roadName] = {};
                if (!hash[roadName][direction]) hash[roadName][direction] = [];
                hash[roadName][direction].push({
                    mile: milemarker,
                    value: pointValue
                });
            }

            // Run through the data and massage it
            // Object.keys(hash).forEach((k) => {
            //     console.log(k, 'N', hash[k]['NB'] ? hash[k]['NB'].length : 0);
            //     console.log(k, 'S', hash[k]['SB'] ? hash[k]['SB'].length : 0);
            //     console.log(k, 'E', hash[k]['EB'] ? hash[k]['EB'].length : 0);
            //     console.log(k, 'W', hash[k]['WB'] ? hash[k]['WB'].length : 0);
            // })

            function roadValueAtIndex(roadName: string, dir: string, index: number, max: number) {
                const roadValues = hash[roadName][dir];
                const realMax = roadValues.length;
                const locationIndex = Math.floor(index / max * realMax);

                //console.log(roadName, dir, index, max, locationIndex, roadValues[locationIndex].value);
                return roadValues[locationIndex].value;
            }

            // Run through each road we care about and fill in the pixels
            Object.keys(roadsWeCareAbout).forEach((k, index) => {
                const road = roadsWeCareAbout[k];
                console.log(k, index);
                // Run through each direction we care about 
                road.directions.forEach((dir, dirIndex) => {
                    const roadArray = [];
                    for (let i = 0; i < road.pixels; i++) {
                        const val = roadValueAtIndex(k, dir, i, road.pixels);
                        roadArray.push(val);
                    }
                    const key = index + (dirIndex ? 4 : 0);
                    roads[key] = roadArray;

                    // console.log(k, dir, roadArray);
                })
            })

            function printInSegments(roadValues: number[], key: number) {
                let i = 0;
                let s = 0;
                let direction = key >= 4 ? 1 : 0;
                let road = key - (direction ? 4 : 0);
                let roadValuesStr = roadValues.join('');
                while (i < roadValues.length) {
                    //console.log(road, direction, s);
                    let values = roadValuesStr.substr(i, SEGMENT_SIZE);
                    maybeTransmitSegment(road, direction, s, values);

                    s++;
                    i += SEGMENT_SIZE;
                }
            }

            roads.forEach((road, index) => {
                printInSegments(road, index);
            })

            //console.log(roads);

            ms = 0;
        },
        function (error) {
            console.error(error);
        }
    );

}