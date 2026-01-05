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

