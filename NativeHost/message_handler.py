#!/usr/bin/env python3

#sorting out the json from the chrome extension and essentially handling the inputs. 
#purpose is for future OS navigation/other apps

#the json manifest must live in a special mac directory for chrome to access it
#TODO: for the future, when users install the program, the json manifest should be copied to that directory

# Receives messages from Chrome via native messagingd
# Calls Layout.print_elements for "elements" type messages

import sys, json
from layout import Layout

layout = Layout()

def read_message():

    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = int.from_bytes(raw_length, byteorder='little')
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):

    encoded = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(len(encoded).to_bytes(4, byteorder='little'))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


while True:
    msg = read_message()
    msg_type = msg.get("type", "unknown")

    if msg_type == "elements":
        elements = msg.get("elements", [])
        print(f"Received {len(elements)} elements from Chrome:")
        layout.print_elements(elements)

    elif msg_type == "os_event":
        print("Received OS event:", msg)
        # Future: handle other app/OS messages

    else:
        print("Unknown message type:", msg)

    send_message({"status": "ok"})
