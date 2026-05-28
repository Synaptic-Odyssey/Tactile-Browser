const WebSocket = require('ws');

const { SerialPort } =
    require('serialport');

const SERIAL_PORT =
    '/dev/cu.usbserial-210';

const BAUD_RATE = 115200;

const port = new SerialPort({

    path: SERIAL_PORT,

    baudRate: BAUD_RATE
});

let latestSocket = null;

port.on('open', () => {

    console.log(
        'Serial connected'
    );
});

const wss =
    new WebSocket.Server({

        port: 8765
    });

console.log(
    'WebSocket server running'
);

wss.on('connection', (ws) => {

    latestSocket = ws;

    console.log(
        'Extension connected'
    );

    ws.on('message', (message) => {

        const str =
            message.toString();

        port.write(
            str + '\n'
        );
    });
});

let serialBuffer = '';

port.on('data', (data) => {

    serialBuffer +=
        data.toString();

    const lines =
        serialBuffer.split('\n');

    serialBuffer =
        lines.pop();

    for (const line of lines) {

        const trimmed =
            line.trim();

        console.log(
            trimmed
        );

        if (
            latestSocket &&
            latestSocket.readyState
            === WebSocket.OPEN
        ) {

            latestSocket.send(
                trimmed
            );
        }
    }
});