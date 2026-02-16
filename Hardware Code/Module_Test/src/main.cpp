#include <Arduino.h>
#include <SPI.h>


const uint8_t CLOCK_PIN = 13;
const uint8_t DATA_PIN = 11;
const uint8_t LATCH_PIN = 10;

uint8_t sr[5];

//TB6612
const uint8_t STBY_PIN = 12;

constexpr uint8_t bitByte(uint8_t bit) {
  return bit / 8;
}

constexpr uint8_t bitMask(uint8_t bit) {
  return 1 << (bit % 8);
}

void setSolenoid(uint8_t solenoid, bool up);
void updateShiftRegisters();


void setup() {

  pinMode(LATCH_PIN, OUTPUT);
  digitalWrite(LATCH_PIN, LOW);

  pinMode(STBY_PIN, OUTPUT);
  digitalWrite(STBY_PIN, HIGH);



  SPI.begin();

}


void loop() {

  setSolenoid(0, false);
  setSolenoid(1, false);
  updateShiftRegisters();
  delay(3000);

  setSolenoid(0, true);
  setSolenoid(1, true);
  updateShiftRegisters();
  delay(3000);
}

//the 74hc595s control solenoids 4-20 but will be numbered 0-16 in code
//returns the bitmask for the given solenoid number
//solenoids are numbered from 0 
//TODO: get rid of bool up, instead just check the sr[] for which solenoids are up or down, then invert the pulse to the tb6612
//TODO: move the remaining 3 solenoids to the 5th 74hc595, so all solenoids can be numbered uniformly
void setSolenoid(uint8_t solenoid, bool up) {

  uint8_t in1_bit = solenoid * 2;
  uint8_t in2_bit = solenoid * 2 + 1;

  //test which is the right direction
  if (up) {
    //this is putting down the solenoid
    sr[bitByte(in1_bit)] |= bitMask(in1_bit);
    sr[bitByte(in2_bit)] &= ~bitMask(in2_bit);
  } else {
    sr[bitByte(in1_bit)] &= ~bitMask(in1_bit);
    sr[bitByte(in2_bit)] |= bitMask(in2_bit);
  }
}


void updateShiftRegisters() {

  digitalWrite(LATCH_PIN, LOW);

  for (int i = 4; i >= 0; i--) {
    SPI.transfer(sr[i]);
  }

  digitalWrite(LATCH_PIN, HIGH);
}

/*
Issue with the code above, doesn't set pulses (20ms max [try lowering it], 20% duty cycle)
Code below for the single solenoid (the reason it was so loud is because 
it was drawing as much amps as it could since I connected the power source to just
one solnoid)
*/

/*

// ----------------------
// Arduino Nano → 74HC595 → TB6612FNG → Bistable Solenoid
// ----------------------

// 74HC595 pins
const int LATCH_PIN = 10;  // RCLK
const int DATA_PIN  = 11;  // SER
const int CLOCK_PIN = 13;  // SRCLK

// TB6612FNG pins
const int PWM_PIN   = 9;   // PWMA
const int STBY_PIN  = 12;  // STBY

// Bit positions in the 74HC595
// QA = bit 0
// QB = bit 1
const int AIN1_BIT = 0;
const int AIN2_BIT = 1;

// Solenoid pulse parameters
const int PULSE_MS = 20;        // pulse duration in ms
const int WAIT_MS  = 2000;      // wait between pulses
const int CYCLES   = 10;        // number of forward/backward cycles

void setup() {
  // 74HC595 pins
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);

  // TB6612FNG pins
  pinMode(PWM_PIN, OUTPUT);
  pinMode(STBY_PIN, OUTPUT);

  // Enable driver
  digitalWrite(STBY_PIN, HIGH);
  analogWrite(PWM_PIN, 255);  // full power (short pulses, safe)

  // Initialize 595 outputs LOW
  write595(0);
}

// Send 8-bit value to 74HC595
void write595(byte data) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, data);
  digitalWrite(LATCH_PIN, HIGH);
}

// Set motor direction via AIN1/AIN2
void setDirection(bool ain1, bool ain2) {
  byte data = 0;
  if (ain1) data |= (1 << AIN1_BIT);
  if (ain2) data |= (1 << AIN2_BIT);
  write595(data);
}

// Pulse solenoid in one direction
void pulseSolenoid(bool forward) {
  if (forward) {
    setDirection(HIGH, LOW);
  } else {
    setDirection(LOW, HIGH);
  }

  delay(PULSE_MS);      // 20ms pulse
  setDirection(LOW, LOW); // stop
}

void loop() {
  for (int i = 0; i < CYCLES; i++) {
    pulseSolenoid(true);    // forward
    delay(WAIT_MS);

    pulseSolenoid(false);   // backward
    delay(WAIT_MS);
  }

  // Stop forever
  setDirection(LOW, LOW);
  while (1);
}
*/