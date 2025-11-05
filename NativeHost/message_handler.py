#!/usr/bin/env python3


#sorting out the json from the chrome extension and essentially handling the inputs. 
#purpose is for future OS navigation/other apps

#the json manifest must live in a special mac directory for chrome to access it
#TODO: for the future, when users install the program, the json manifest should be copied to that directory

# Receives messages from Chrome via native messagingd
# Calls Layout.print_elements for "elements" type messages


import sys
import json
from datetime import datetime
import traceback

LOG_FILE = "/Users/kevin/Github/Tactile-Browser/NativeHost/debug.log"

def log(msg):
    """Write a message to the log file"""
    try:
        with open(LOG_FILE, "a") as f:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {msg}\n")
            f.flush()
    except Exception as e:
        print(f"Logging error: {e}", file=sys.stderr)
        

def read_message():
    """Read a message from Chrome"""
    try:
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            log("No more input, exiting")
            sys.exit(0)
        
        message_length = int.from_bytes(raw_length, byteorder='little')
        log(f"Reading message of length: {message_length}")
        
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)
    except Exception as e:
        log(f"Error reading message: {e}")
        log(traceback.format_exc())
        raise

def send_message(message):
    """Send a message back to Chrome"""
    try:
        encoded = json.dumps(message).encode('utf-8')
        sys.stdout.buffer.write(len(encoded).to_bytes(4, byteorder='little'))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()
        log(f"Sent response: {message}")
    except Exception as e:
        log(f"Error sending message: {e}")
        log(traceback.format_exc())
        raise

def print_element_tree(elements, indent=0):
    """Recursively print the element tree structure"""
    output = []
    for elem in elements:
        tag = elem.get('tag', 'unknown')
        text = elem.get('text', '')[:50]  # First 50 chars
        interactive = elem.get('isInteractive', False)
        position = elem.get('position', {})
        
        prefix = "  " * indent
        line = f"{prefix}- {tag}"
        if text:
            line += f" '{text}'"
        if interactive:
            line += " [INTERACTIVE]"
        line += f" pos:({position.get('x', 0):.0f}, {position.get('y', 0):.0f})"
        
        output.append(line)
        
        children = elem.get('children', [])
        if children:
            output.extend(print_element_tree(children, indent + 1))
    
    return output


log("="*70)
log("TACTILE BROWSER NATIVE HOST STARTED")
log("="*70)

try:
    message_count = 0
    
    while True:
        try:
            message_count += 1
            log(f"\n--- MESSAGE #{message_count} ---")
            
            msg = read_message()
            msg_type = msg.get("type", "unknown")
            
            log(f"Message type: {msg_type}")
            
            if msg_type == "elements":
                elements = msg.get("elements", [])
                url = msg.get("url", "unknown")
                timestamp = msg.get("timestamp", "unknown")
                
                log(f"URL: {url}")
                log(f"Timestamp: {timestamp}")
                log(f"Total root elements: {len(elements)}")
                
                def count_all_elements(elems):
                    count = len(elems)
                    for elem in elems:
                        count += count_all_elements(elem.get('children', []))
                    return count
                
                total_elements = count_all_elements(elements)
                log(f"Total elements (including nested): {total_elements}")
                
                log("\nElement tree:")
                tree_output = print_element_tree(elements)
                for line in tree_output[:50]:  # Print first 50 lines
                    log(line)
                
                if len(tree_output) > 50:
                    log(f"... and {len(tree_output) - 50} more lines")
                
                def count_interactive(elems):
                    count = sum(1 for e in elems if e.get('isInteractive', False))
                    for elem in elems:
                        count += count_interactive(elem.get('children', []))
                    return count
                
                interactive_count = count_interactive(elements)
                log(f"\nInteractive elements: {interactive_count}")
                
            elif msg_type == "os_event":
                log(f"OS event received: {msg}")
            else:
                log(f"Unknown message type: {msg_type}")
                log(f"Full message: {json.dumps(msg, indent=2)}")
            
            send_message({"status": "ok"})
            log("Response sent successfully")
            
        except Exception as e:
            log(f"ERROR processing message: {e}")
            log(traceback.format_exc())
            
            try:
                send_message({"status": "error", "message": str(e)})
            except:
                log("Failed to send error response")
            
            
except KeyboardInterrupt:
    log("Received keyboard interrupt, shutting down")
except Exception as e:
    log(f"FATAL ERROR in main loop: {e}")
    log(traceback.format_exc())
finally:
    log("Native host shutting down")
    log("="*70)