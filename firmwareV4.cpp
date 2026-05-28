const int LATCH_PIN = 10;
const int DATA_PIN  = 11;
const int CLOCK_PIN = 13;

const int PWM_PIN   = 9;
const int STBY_PIN  = 12;

const int ROWS = 3;
const int COLS = 6;

const int NUM_595 = 5;

const int PULSE_MS = 10;

const int MAX_BATCH = 12;

const unsigned long LONG_PRESS_MS = 600;

byte regs[NUM_595] = {0,0,0,0,0};

bool currentState[3][6];

bool buttonState[3][6];
bool longSent[3][6];

unsigned long pressStart[3][6];

const int rowPins[3] = {2,3,4};
const int colPins[6] = {5,6,7,8,A0,A1};

struct SolenoidMap {

  int regIndex;
  int bitRaise;
  int bitLower;
};

SolenoidMap solenoids[18] = {

  {1,0,1},
  {1,2,3},
  {1,4,5},
  {1,6,7},

  {2,0,1},
  {2,2,3},
  {2,4,5},
  {2,6,7},

  {3,0,1},
  {3,2,3},
  {3,4,5},
  {3,6,7},

  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1},
  {-1,-1,-1}
};

void setup() {

  Serial.begin(115200);

  pinMode(LATCH_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);

  pinMode(PWM_PIN, OUTPUT);
  pinMode(STBY_PIN, OUTPUT);

  digitalWrite(STBY_PIN, LOW);

  analogWrite(PWM_PIN, 255);

  digitalWrite(STBY_PIN, HIGH);

  clearAllRegisters();

  for (int r = 0; r < ROWS; r++) {

    pinMode(rowPins[r], OUTPUT);

    digitalWrite(rowPins[r], HIGH);
  }

  for (int c = 0; c < COLS; c++) {

    pinMode(colPins[c], INPUT_PULLUP);
  }

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      currentState[r][c] = false;

      buttonState[r][c] = false;

      longSent[r][c] = false;

      pressStart[r][c] = 0;
    }
  }

  Serial.println("READY");
}

void loop() {

  handleSerialInput();

  scanButtons();
}

void handleSerialInput() {

  if (!Serial.available())
    return;

  String line =
    Serial.readStringUntil('\n');

  line.trim();

  if (line.length() != 18)
    return;

  bool newPattern[3][6];

  int index = 0;

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      newPattern[r][c] =
        (line[index] == '1');

      index++;
    }
  }

  applyPattern(newPattern);
}

void applyPattern(bool newPattern[3][6]) {

  int batchCount = 0;

  clearAllRegisters();

  for (int r = 0; r < ROWS; r++) {

    for (int c = 0; c < COLS; c++) {

      bool oldState =
        currentState[r][c];

      bool newState =
        newPattern[r][c];

      if (oldState == newState)
        continue;

      int index =
        r * 6 + c;

      if (newState) {

        activateSolenoid(
          index,
          true
        );

      } else {

        activateSolenoid(
          index,
          false
        );
      }

      currentState[r][c] =
        newState;

      batchCount++;

      if (batchCount >= MAX_BATCH) {

        pulseRegisters();

        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {

    pulseRegisters();
  }
}

void pulseRegisters() {

  writeAllRegisters();

  delay(PULSE_MS);

  clearAllRegisters();

  delay(6);
}

void scanButtons() {

  for (int r = 0; r < ROWS; r++) {

    digitalWrite(rowPins[r], LOW);

    for (int c = 0; c < COLS; c++) {

      bool pressed =
        digitalRead(colPins[c]) == LOW;

      if (
        pressed &&
        !buttonState[r][c]
      ) {

        buttonState[r][c] = true;

        longSent[r][c] = false;

        pressStart[r][c] = millis();
      }

      else if (
        !pressed &&
        buttonState[r][c]
      ) {

        buttonState[r][c] = false;

        if (!longSent[r][c]) {

          Serial.print("SHORT:");
          Serial.print(r);
          Serial.print(",");
          Serial.println(c);
        }
      }

      else if (
        pressed &&
        buttonState[r][c] &&
        !longSent[r][c]
      ) {

        if (
          millis() - pressStart[r][c]
          > LONG_PRESS_MS
        ) {

          longSent[r][c] = true;

          Serial.print("LONG:");
          Serial.print(r);
          Serial.print(",");
          Serial.println(c);
        }
      }
    }

    digitalWrite(rowPins[r], HIGH);
  }
}

void activateSolenoid(
  int index,
  bool raise
) {

  if (index < 0 || index >= 18)
    return;

  SolenoidMap s =
    solenoids[index];

  if (s.regIndex == -1)
    return;

  if (raise) {

    regs[s.regIndex] |=
      (1 << s.bitRaise);

  } else {

    regs[s.regIndex] |=
      (1 << s.bitLower);
  }
}

void writeAllRegisters() {

  digitalWrite(LATCH_PIN, LOW);

  for (
    int i = NUM_595 - 1;
    i >= 0;
    i--
  ) {

    shiftOut(
      DATA_PIN,
      CLOCK_PIN,
      MSBFIRST,
      regs[i]
    );
  }

  digitalWrite(LATCH_PIN, HIGH);
}

void clearAllRegisters() {

  for (int i = 0; i < NUM_595; i++) {

    regs[i] = 0;
  }

  writeAllRegisters();
}