

/* global fetch */

// INITS
var mediaElement, input2;


function gotStream() {
    // Create an AudioNode from the stream.
    mediaElement = document.getElementById('player');

    if (input2 === undefined) {
        input2 = audioContext.createMediaElementSource(mediaElement);
    }

    var input = audioContext.createMediaStreamSource(window.stream);
    audioInput = convertToMono(input);

    createAmp(audioContext, audioInput, input2);
    console.log('AMP CREATED')
}

var amp;
var analyzerAtInput, analyzerAtOutput;
var guitarPluggedIn = false;
var convolverSlider;
var convolverCabinetSlider;
var guitarInput;

// Create the amp
function createAmp(context, input1, input2) {
    guitarInput = input1;

    // create quadrafuzz
    amp = new Amp(context);
    analyzerAtInput = context.createAnalyser();
    amp.input.connect(analyzerAtInput);

    // build graph
    if (guitarPluggedIn) {
        guitarInput.connect(amp.input);
    }

    // connect audio player to amp for previewing presets
    input2.connect(amp.input);

    // output, add an analyser at the end
    analyzerAtOutput = context.createAnalyser();
    amp.output.connect(analyzerAtOutput);
    analyzerAtOutput.connect(context.destination);

    convolverSlider = document.querySelector('#convolverSlider');
    convolverCabinetSlider = document.querySelector('#convolverCabinetSlider');

    initVisualizations();
}

function toggleGuitarInput(event) {
    var button = document.querySelector("#toggleGuitarIn");

    if (!guitarPluggedIn) {
        guitarInput.connect(amp.input);
        button.innerHTML = "Guitar input: <span style='color:green;'>ACTIVATED</span>, click to toggle on/off!";
        button.classList.remove("pulse");
    } else {
        guitarInput.disconnect();
        button.innerHTML = "Guitar input: <span style='color:red;'>NOT ACTIVATED</span>, click to toggle on/off!";
        button.classList.add("pulse");
    }
    guitarPluggedIn = !guitarPluggedIn;
}

// Visualizations
var inputVisualization, outputVisualization;

function initVisualizations() {
    inputVisualization = new Visualization();
    inputVisualization.configure("inputSignalCanvas", analyzerAtInput);

    outputVisualization = new Visualization();
    outputVisualization.configure("outputSignalCanvas", analyzerAtOutput);


    // start updating the visualizations
    requestAnimationFrame(visualize);
}

function visualize() {
    inputVisualization.update();
    outputVisualization.update();

    requestAnimationFrame(visualize);
}

// effects
//----------- EQUALIZER ----------- 
function Equalizer(ctx) {
    var filters = [];

    // Set filters
    [60, 170, 350, 1000, 3500, 10000].forEach(function (freq, i) {
        var eq = ctx.createBiquadFilter();
        eq.frequency.value = freq;
        eq.type = "peaking";
        eq.gain.value = 0;
        filters.push(eq);
    });

    // Connect filters in serie
    //sourceNode.connect(filters[0]);

    for (var i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }

    // connect the last filter to the speakers
    //filters[filters.length - 1].connect(ctx.destination);

    function changeGain(sliderVal, nbFilter) {
        // sliderVal in [-30, +30]
        var value = parseFloat(sliderVal);
        filters[nbFilter].gain.value = value;

        // update output labels
        //var output = document.querySelector("#gain" + nbFilter);
        //output.value = value + " dB";

        // update sliders
        //var numSlider = nbFilter + 1;
        //var slider = document.querySelector("#EQ" + numSlider + "slider");
        //slider.value = value;

        // refresh amp slider state in the web component GUI
        var sliderWC = document.querySelector("#slider" + (nbFilter + 1));
        // second parameter set to false will not fire an event
        sliderWC.setValue(parseFloat(sliderVal).toFixed(0), false);
    }

    function setValues(values) {
        values.forEach(function (val, index) {
            changeGain(val, index);
        });
    }

    function getValues() {
        var values = [];
        filters.forEach(function (f, index) {
            values.push(f.gain.value);
        });
        return values;
    }

    return {
        input: filters[0],
        output: filters[filters.length - 1],
        setValues: setValues,
        getValues: getValues,
        changeGain: changeGain
    };
}

// ----------- AMP ---------------

function Amp(context) {
    var presets = [];
    var menuPresets = document.querySelector("#QFPresetMenu2");
    var menuDisto = document.querySelector("#distorsionMenu");
    // for the waveshapers from the preamp
    var wsFactory = new WaveShapers();
    buildDistoMenu();

    var currentDistoName = "standard";
    var currentK = 2; // we have separates ks, but also a "global" one that
    // is the max of the four (the knob value)
    var currentWSCurve = wsFactory.distorsionCurves[currentDistoName](currentK);
    // for Wave Shaper Curves visualization
    var distoDrawer, signalDrawer;
    var DRAWER_CANVAS_SIZE = 100;
    var distoDrawer = new CurveDrawer("distoDrawerCanvas");
    var signalDrawer = new CurveDrawer("signalDrawerCanvas");
    drawCurrentDisto();

    // ------------
    // PREAM STAGE
    // ------------
    // Channel booster
    var boost = new Boost(context);

    // Main input and output and bypass
    var input = context.createGain();
    var output = context.createGain();
    var byPass = context.createGain();
    byPass.gain.value = 0;

    // amp input gain towards pream stage
    var inputGain = context.createGain();
    inputGain.gain.value = 1;

    // low and high cut filters
    var lowCutFilter = context.createBiquadFilter();
    lowCutFilter.type = "highpass";
    lowCutFilter.frequency.value = 20;

    var hiCutFilter = context.createBiquadFilter();
    hiCutFilter.type = "lowpass";
    hiCutFilter.frequency.value = 12000;


    // band filters for quadrafuzz like circuitry
    var filters = [];
    var lowpassLeft = context.createBiquadFilter();
    lowpassLeft.frequency.value = 147;
    lowpassLeft.type = "lowpass";
    filters[0] = lowpassLeft;

    var bandpass1Left = context.createBiquadFilter();
    bandpass1Left.frequency.value = 587;
    bandpass1Left.type = "bandpass";
    filters[1] = bandpass1Left;

    var bandpass2Left = context.createBiquadFilter();
    bandpass2Left.frequency.value = 2490;
    bandpass2Left.type = "bandpass";
    filters[2] = bandpass2Left;

    var highpassLeft = context.createBiquadFilter();
    highpassLeft.frequency.value = 4980;
    highpassLeft.type = "highpass";
    filters[3] = highpassLeft;

    // overdrives
    var k = [2, 2, 2, 2]; // array of k initial values
    var od = [];
    var gainsOds = [];
// noprotect  
    for (var i = 0; i < 4; i++) {
        od[i] = context.createWaveShaper();
        od[i].curve = makeDistortionCurve(k[i]);
        // Oversampling generates some (small) latency
        //od[i].oversample = '4x';

        // gains
        gainsOds[i] = context.createGain();
        gainsOds[i].gain.value = 1;
    }

    // output gain after amp stage
    var outputGain = context.createGain();
    outputGain.gain.value = 1;

    // ------------------------------
    // POWER AMP AND TONESTACK STAGES
    // ------------------------------
    var bassFilter = context.createBiquadFilter();
    bassFilter.frequency.value = 100;
    bassFilter.type = "lowshelf";

    var midFilter = context.createBiquadFilter();
    midFilter.frequency.value = 1700;
    midFilter.type = "peaking";

    var trebleFilter = context.createBiquadFilter();
    trebleFilter.frequency.value = 6500;
    trebleFilter.type = "highshelf";

    var presenceFilter = context.createBiquadFilter();
    presenceFilter.frequency.value = 3900;
    presenceFilter.type = "peaking";

    // -----------------------------------
    // POST PROCESSING STAGE (EQ, reverb)
    // -----------------------------------
    var eq = new Equalizer(context);
    var bypassEQg = context.createGain();
    bypassEQg.gain.value = 0; // by defaut EQ is in
    var inputEQ = context.createGain();

    var cabinetSim, reverb;
    // Master volume
    var masterVolume = context.createGain();

    /*
     reverb = new Reverb(context, function () {
     console.log("reverb created");
     
     cabinetSim = new CabinetSimulator(context, function () {
     console.log("cabinet sim created");
     
     doAllConnections();
     
     });
     });
     */

    reverb = new Convolver(context, reverbImpulses, "reverbImpulses");
    cabinetSim = new Convolver(context, cabinetImpulses, "cabinetImpulses");

    doAllConnections();

    // -------------------
    // END OF AMP STAGES
    // -------------------

    function doAllConnections() {
        // called only after reverb and cabinet sim could load and
        // decode impulses

        // Build web audio graph, set default preset
        buildGraph();
        initPresets();

        setDefaultPreset();
        console.log("running");
    }


    function buildGraph() {
        input.connect(inputGain);
        input.connect(byPass);

        // boost is not activated, it's just a sort of disto at 
        // the very beginning of the amp route
        inputGain.connect(boost.input);

        boost.output.connect(lowCutFilter);
        lowCutFilter.connect(hiCutFilter);

        for (var i = 0; i < 4; i++) {
            hiCutFilter.connect(filters[i]);
            filters[i].connect(od[i]);
            od[i].connect(gainsOds[i]);
            gainsOds[i].connect(outputGain);
        }
        // tonestack
        outputGain.connect(bassFilter);
        bassFilter.connect(midFilter);
        midFilter.connect(trebleFilter);
        trebleFilter.connect(presenceFilter);

        // post process
        presenceFilter.connect(inputEQ);
        // bypass eq route
        presenceFilter.connect(bypassEQg);
        bypassEQg.connect(masterVolume);

        // normal route
        inputEQ.connect(eq.input);
        eq.output.connect(masterVolume);
        masterVolume.connect(reverb.input);

        reverb.output.connect(cabinetSim.input);
        cabinetSim.output.connect(output);
        //eq.output.connect(output);
        //reverb.output.connect(output);

        // byPass route
        byPass.connect(output);
    }

    function boostOnOff(cb) {
        // called when we click the switch on the GUI      
        boost.toggle();

        adjustOutputGainIfBoostActivated();
        updateBoostLedButtonState(boost.isActivated());
    }

    function changeBoost(state) {
        console.log("changeBoost, boost before: " + boost.isActivated() + " output gain=" + output.gain.value);

        if (boost.isActivated() !== state) {
            // we need to adjust the output gain
            console.log("changeBoost: we change boost state");
            boost.onOff(state);
            adjustOutputGainIfBoostActivated();
            updateBoostLedButtonState(boost.isActivated());
        } else {
            console.log("changeBoost: we do not change boost state");
        }

        console.log("changeBoost, boost after: " + boost.isActivated());
    }

    function adjustOutputGainIfBoostActivated() {
        console.log("adjustOutputGainIfBoostActivated: output gain value before = " + output.gain.value)

        if (boost.isActivated()) {
            output.gain.value /= 2;
        } else {
            output.gain.value *= 2;
        }
        console.log("adjustOutputGainIfBoostActivated: output gain value after = " + output.gain.value)
    }

    function updateBoostLedButtonState(activated) {
        // update buttons states
        var boostSwitch = document.querySelector("#toggleBoost");

        if (boost.isActivated()) {
            boostSwitch.setValue(1, false);
        } else {
            boostSwitch.setValue(0, false);
        }
    }


    function changeInputGainValue(sliderVal) {
        input.gain.value = parseFloat(sliderVal);
    }

    function changeOutputGainValue(sliderVal) {
        output.gain.value = parseFloat(sliderVal) / 10;
        console.log("changeOutputGainValue value = " + output.gain.value);
    }


    function changeLowCutFreqValue(sliderVal) {
        var value = parseFloat(sliderVal);
        lowCutFilter.frequency.value = value;

        // update output labels
        var output = document.querySelector("#lowCutFreq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#lowCutFreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeHicutFreqValue(sliderVal) {
        var value = parseFloat(sliderVal);
        hiCutFilter.frequency.value = value;

        // update output labels
        var output = document.querySelector("#hiCutFreq");
        output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

        // refresh slider state
        var slider = document.querySelector("#hiCutFreqSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);
    }

    function changeBassFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        bassFilter.gain.value = (value - 5) * 3;
        console.log("bass gain set to " + bassFilter.gain.value);

        // update output labels
        //var output = document.querySelector("#bassFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#bassFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob4");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeMidFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        midFilter.gain.value = (value - 5) * 2;

        // update output labels
        //var output = document.querySelector("#midFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#midFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob5");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeTrebleFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        trebleFilter.gain.value = (value - 5) * 5;

        // update output labels
        //var output = document.querySelector("#trebleFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#trebleFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob6");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changePresenceFilterValue(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        presenceFilter.gain.value = (value - 5) * 2;
        //console.log("set presence freq to " + presenceFilter.frequency.value)

        // update output labels
        //var output = document.querySelector("#presenceFreq");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#presenceFreqSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob8");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    // Build a drop down menu with all distorsion names
    function buildDistoMenu() {
        for (var p in wsFactory.distorsionCurves) {
            var option = document.createElement("option");
            option.value = p;
            option.text = p;
            menuDisto.appendChild(option);
        }
        menuDisto.onchange = changeDistoType;
    }

    function changeDistoType() {
        console.log("Changing disto to : " + menuDisto.value);
        currentDistoName = menuDisto.value;
        changeDrive(currentK);
    }

    function changeDistoTypeFromPreset(name) {
        currentDistoName = name;
        menuDisto.value = name;
        changeDrive(currentK);
    }

    function changeDrive(sliderValue) {
        // sliderValue in [0,10]
        // We can imagine having some "profiles here" -> generate
        // different K values from one single sliderValue for the
        // drive.
        var profileValues = [1, 1, 1, 1];
        // other values i.e [0.5, 0.5, 0.8, 1] -> less distorsion
        // on bass frequencies and top high frequency

        for (var i = 0; i < 4; i++) {
            // less distorsion on bass channels
            if (i < 2) {
                changeDistorsionValues(sliderValue / 2, i);
            } else {
                changeDistorsionValues(sliderValue, i);
            }

        }
    }

    function changeDistorsionValues(sliderValue, numDisto) {
        // sliderValue is in [0, 10] range, adjust to [0, 1500] range  
        var value = 150 * parseFloat(sliderValue);
        var minp = 0;
        var maxp = 1500;

        // The result should be between 10 an 1500
        var minv = Math.log(10);
        var maxv = Math.log(1500);

        // calculate adjustment factor
        var scale = (maxv - minv) / (maxp - minp);

        value = Math.exp(minv + scale * (value - minp));
        // end of logarithmic adjustment

        k[numDisto] = value;
        //console.log("k = " + value + " pos = " + logToPos(value));
        od[numDisto].curve = makeDistortionCurve(k[numDisto]);
        //od[numDisto].curve = makeDistortionCurve(sliderValue);
        // update output labels
        var output = document.querySelector("#k" + numDisto);
        output.value = parseFloat(sliderValue).toFixed(1);

        // update sliders
        var numSlider = numDisto + 1;
        var slider = document.querySelector("#K" + numSlider + "slider");
        slider.value = parseFloat(sliderValue).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob3");
        var maxPosVal1 = Math.max(logToPos(k[2]), logToPos(k[3]));
        var maxPosVal2 = Math.max(logToPos(k[0]), logToPos(k[1]));
        var maxPosVal = Math.max(maxPosVal1, maxPosVal2);
        //var maxPosVal = Math.max(logToPos(k[2]), logToPos(k[3]));
        var linearValue = parseFloat(maxPosVal).toFixed(1);
        knob.setValue(linearValue, false);
        // in [0, 10]
        currentK = linearValue;
        // redraw curves
        drawCurrentDisto();
    }

    function logToPos(logValue) {
        var minp = 0;
        var maxp = 1500;

        // The result should be between 10 an 1500
        var minv = Math.log(10);
        var maxv = Math.log(1500);

        // calculate adjustment factor
        var scale = (maxv - minv) / (maxp - minp);

        return (minp + (Math.log(logValue) - minv) / scale) / 150;
    }

    function changeOversampling(cb) {
        for (var i = 0; i < 4; i++) {
            if (cb.checked) {
                // Oversampling generates some (small) latency
                od[i].oversample = '4x';
                boost.setOversampling('4x');
                console.log("set oversampling to 4x");
            } else {
                od[i].oversample = 'none';
                boost.setOversampling('none');
                console.log("set oversampling to none");
            }
        }
        // Not sure if this is necessary... My ears can't hear the difference
        // between oversampling=node and 4x ? Maybe we should re-init the
        // waveshaper curves ?
        changeDistoType();
    }

    // Returns an array of distorsions values in [0, 10] range
    function getDistorsionValue(numChannel) {
        var pos = logToPos(k[numChannel]);
        return parseFloat(pos).toFixed(1);
    }

    function drawCurrentDisto() {
        var c = currentWSCurve;
        distoDrawer.clear();
        drawCurve(distoDrawer, c);

        // draw signal
        signalDrawer.clear();
        signalDrawer.drawAxis();
        signalDrawer.makeCurve(Math.sin, 0, Math.PI * 2);
        signalDrawer.drawCurve('red', 2);

        //signalDrawer.makeCurve(distord, 0, Math.PI*2);
        var c1 = distord();
        drawCurve(signalDrawer, c1);
    }
    function distord() {
        // return the curve of sin(x) transformed by the current wave shaper
        // function
        // x is in [0, 2*Math.PI]
        // sin(x) in [-1, 1]

        // current distorsion curve
        var c = currentWSCurve;
        var curveLength = c.length;

        var c2 = new Float32Array(DRAWER_CANVAS_SIZE);
        // sin(x) -> ?
        // [-1, 1] -> [0, length -1]

        // 100 is the canvas size.
        var incX = 2 * Math.PI / DRAWER_CANVAS_SIZE;
        var x = 0;
        for (var i = 0; i < DRAWER_CANVAS_SIZE; i++) {
            var index = map(Math.sin(x), -1, 1, 0, curveLength - 1);
            c2[i] = c[Math.round(index)];
            x += incX;
        }
        return c2;
    }


    function changeQValues(sliderVal, numQ) {
        var value = parseFloat(sliderVal);
        filters[numQ].Q.value = value;

        // update output labels
        var output = document.querySelector("#q" + numQ);
        output.value = value.toFixed(1);

        // update sliders
        var numSlider = numQ + 1;
        var slider = document.querySelector("#Q" + numSlider + "slider");
        slider.value = value;

    }

    function changeFreqValues(sliderVal, numF) {
        var value = parseFloat(sliderVal);
        filters[numF].frequency.value = value;

        // update output labels
        var output = document.querySelector("#freq" + numF);
        output.value = value + " Hz";
        // refresh slider state
        var numSlider = numF + 1;
        var slider = document.querySelector("#F" + numSlider + "slider");
        slider.value = value;
    }

    // volume aka preamp output volume
    function changeOutputGain(sliderVal) {
        // sliderVal is in [0, 10]
        // Adjust to [0, 1]
        var value = parseFloat(sliderVal / 10);
        outputGain.gain.value = value;

        // update output labels
        //var output = document.querySelector("#outputGain");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#OGslider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob1");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeMasterVolume(sliderVal) {
        // sliderVal is in [0, 10]
        var value = parseFloat(sliderVal);
        masterVolume.gain.value = value;

        // update output labels
        //var output = document.querySelector("#MVOutputGain");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#MVslider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob2");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeReverbGain(sliderVal) {
        // slider val in [0, 10] range
        // adjust to [0, 1]
        var value = parseFloat(sliderVal) / 10;
        reverb.setGain(value);

        // update output labels
        //var output = document.querySelector("#reverbGainOutput");
        //output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        //var slider = document.querySelector("#convolverSlider");
        //slider.value = parseFloat(sliderVal).toFixed(1);

        // refresh knob state
        var knob = document.querySelector("#Knob7");
        knob.setValue(parseFloat(sliderVal).toFixed(1), false);
    }

    function changeReverbImpulse(name) {
        reverb.loadImpulseByName(name);
    }

    function changeRoom(sliderVal) {
        // slider val in [0, 10] range
        // adjust to [0, 1]
        console.log('change room');
        var value = parseFloat(sliderVal) / 10;
        cabinetSim.setGain(value);

        // update output labels
        var output = document.querySelector("#cabinetGainOutput");
        output.value = parseFloat(sliderVal).toFixed(1);

        // refresh slider state
        var slider = document.querySelector("#convolverCabinetSlider");
        slider.value = parseFloat(sliderVal).toFixed(1);

    }

    function changeCabinetSimImpulse(name) {
        cabinetSim.loadImpulseByName(name);
    }

    function changeEQValues(eqValues) {
        eq.setValues(eqValues);
    }

    function makeDistortionCurve(k) {
        // compute a new ws curve for current disto name and current k
        currentWSCurve = wsFactory.distorsionCurves[currentDistoName](k);
        return currentWSCurve;
    }

    // --------
    // PRESETS
    // --------
    function initPresets() {
        // updated 10/4/2016
       //preset1 = {"name": "Clean 1", "distoName": "standard", "boost": false, "LCF": 200, "HCF": 12000, "K1": "0.0", "K2": "0.0", "K3": "0.0", "K4": "0.0", "F1": 147, "F2": 569, "F3": 1915, "F4": 4680, "Q1": "0.0", "Q2": "49.0", "Q3": "42.0", "Q4": "11.0", "OG": "5.0", "BF": "5.0", "MF": "4.2", "TF": "3.1", "PF": "5.0", "EQ": [-2, -1, 0, 3, -9, -4], "MV": "5.8", "RN": "Fender Hot Rod", "RG": "2.0", "CN": "Vintage Marshall 1", "CG": "2.0"};
        //presets.push(preset1);
        
        
         fetch('/getAllPresets')
          .then(function(response) {
            return response.json();
          }).then(function(json) {
             presets = json;
             
             presets.forEach(function (p, index) {
                var option = document.createElement("option");
                option.value = index;
                option.text = p.name;
                menuPresets.appendChild(option);
            });
             
          }).catch(function(ex) {
            console.log('parsing failed', ex);
          });

        menuPresets.onchange = changePreset;
    }

    function changePreset() {
        setPreset(presets[menuPresets.value]);
    }

    function setPreset(p) {
        if (p.distoName === undefined) {
            p.distoName = "standard";
        }

        if (p.boost === undefined)
            p.boost = false;
        changeBoost(p.boost);

        changeLowCutFreqValue(p.LCF);
        changeHicutFreqValue(p.HCF);

        changeDistorsionValues(p.K1, 0);
        changeDistorsionValues(p.K2, 1);
        changeDistorsionValues(p.K3, 2);
        changeDistorsionValues(p.K4, 3);

        changeFreqValues(p.F1, 0);
        changeFreqValues(p.F2, 1);
        changeFreqValues(p.F3, 2);
        changeFreqValues(p.F4, 3);

        changeQValues(p.Q1, 0);
        changeQValues(p.Q2, 1);
        changeQValues(p.Q3, 2);
        changeQValues(p.Q4, 3);

        changeOutputGain(p.OG);

        changeBassFilterValue(p.BF);
        changeMidFilterValue(p.MF);
        changeTrebleFilterValue(p.TF);
        changePresenceFilterValue(p.PF);

        changeMasterVolume(p.MV);

        changeReverbGain(p.RG);
        changeReverbImpulse(p.RN);

        changeRoom(p.CG);
        changeCabinetSimImpulse(p.CN);

        changeEQValues(p.EQ);


        changeDistoTypeFromPreset(p.distoName);
    }

    function getPresets() {
        return presets;
    }

     function setDefaultPreset() {
     
    // setPreset(preset1);
     }

    function printCurrentAmpValues() {
        var currentPresetValue = {
            name: 'current',
            distoName: currentDistoName,
            boost: boost.isActivated(),
            LCF: lowCutFilter.frequency.value,
            HCF: hiCutFilter.frequency.value,
            K1: getDistorsionValue(0),
            K2: getDistorsionValue(1),
            K3: getDistorsionValue(2),
            K4: getDistorsionValue(3),
            F1: filters[0].frequency.value,
            F2: filters[1].frequency.value,
            F3: filters[2].frequency.value,
            F4: filters[3].frequency.value,
            Q1: filters[0].Q.value.toFixed(1),
            Q2: filters[1].Q.value.toFixed(1),
            Q3: filters[2].Q.value.toFixed(1),
            Q4: filters[3].Q.value.toFixed(1),
            OG: (outputGain.gain.value * 10).toFixed(1),
            BF: ((bassFilter.gain.value / 3) + 5).toFixed(1), // bassFilter.gain.value = (value-5) * 3;
            MF: ((midFilter.gain.value / 2) + 5).toFixed(1), // midFilter.gain.value = (value-5) * 2;
            TF: ((trebleFilter.gain.value / 5) + 5).toFixed(1), // trebleFilter.gain.value = (value-5) * 5;
            PF: ((presenceFilter.gain.value / 2) + 5).toFixed(1), // presenceFilter.gain.value = (value-5) * 2;
            EQ: eq.getValues(),
            MV: masterVolume.gain.value.toFixed(1),
            RN: reverb.getName(),
            RG: (reverb.getGain() * 10).toFixed(1),
            CN: cabinetSim.getName(),
            CG: (cabinetSim.getGain() * 10).toFixed(1)
        };

        console.log(JSON.stringify(currentPresetValue));
    }

    
    
    function sendData() {
        
        
    var currentPreset = {
            name: prompt("Please enter preset name", "My Preset"),
            distoName : currentDistoName,
            boost: boost.isActivated(),
            LCF: lowCutFilter.frequency.value,
            HCF: hiCutFilter.frequency.value,
            K1: getDistorsionValue(0),
            K2: getDistorsionValue(1),
            K3: getDistorsionValue(2),
            K4: getDistorsionValue(3),
            F1: filters[0].frequency.value,
            F2: filters[1].frequency.value,
            F3: filters[2].frequency.value,
            F4: filters[3].frequency.value,
            Q1: filters[0].Q.value.toFixed(1),
            Q2: filters[1].Q.value.toFixed(1),
            Q3: filters[2].Q.value.toFixed(1),
            Q4: filters[3].Q.value.toFixed(1),
            OG: (outputGain.gain.value*10).toFixed(1),
            BF: ((bassFilter.gain.value / 3) + 5).toFixed(1), // bassFilter.gain.value = (value-5) * 3;
            MF: ((midFilter.gain.value / 2) + 5).toFixed(1), // midFilter.gain.value = (value-5) * 2;
            TF: ((trebleFilter.gain.value / 5) + 5).toFixed(1), // trebleFilter.gain.value = (value-5) * 5;
            PF: ((presenceFilter.gain.value / 2) + 5).toFixed(1), // presenceFilter.gain.value = (value-5) * 2;
            EQ: eq.getValues(),
            MV: masterVolume.gain.value.toFixed(1),
            RN: reverb.getName(),
            RG: (reverb.getGain()*10).toFixed(1),
            CN: cabinetSim.getName(),
            CG: (cabinetSim.getGain()*10).toFixed(1)
       };
       
     
    fetch('/addPreset', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(currentPreset)
    });

 }
 
 function updateData() {
     var currentPreset = {
            name: menuPresets.options[menuPresets.selectedIndex].text,
            distoName : currentDistoName,
            boost: boost.isActivated(),
            LCF: lowCutFilter.frequency.value,
            HCF: hiCutFilter.frequency.value,
            K1: getDistorsionValue(0),
            K2: getDistorsionValue(1),
            K3: getDistorsionValue(2),
            K4: getDistorsionValue(3),
            F1: filters[0].frequency.value,
            F2: filters[1].frequency.value,
            F3: filters[2].frequency.value,
            F4: filters[3].frequency.value,
            Q1: filters[0].Q.value.toFixed(1),
            Q2: filters[1].Q.value.toFixed(1),
            Q3: filters[2].Q.value.toFixed(1),
            Q4: filters[3].Q.value.toFixed(1),
            OG: (outputGain.gain.value*10).toFixed(1),
            BF: ((bassFilter.gain.value / 3) + 5).toFixed(1), // bassFilter.gain.value = (value-5) * 3;
            MF: ((midFilter.gain.value / 2) + 5).toFixed(1), // midFilter.gain.value = (value-5) * 2;
            TF: ((trebleFilter.gain.value / 5) + 5).toFixed(1), // trebleFilter.gain.value = (value-5) * 5;
            PF: ((presenceFilter.gain.value / 2) + 5).toFixed(1), // presenceFilter.gain.value = (value-5) * 2;
            EQ: eq.getValues(),
            MV: masterVolume.gain.value.toFixed(1),
            RN: reverb.getName(),
            RG: (reverb.getGain()*10).toFixed(1),
            CN: cabinetSim.getName(),
            CG: (cabinetSim.getGain()*10).toFixed(1)
       };
       
       fetch('/updatePreset', {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentPreset)
      });
 }
 
 function deleteData() {
     var presetName = menuPresets.options[menuPresets.selectedIndex].text;
     
     var currentPresetName = {name: presetName};
     
    fetch('/delPreset', {
         method: 'DELETE',
         headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
         body: JSON.stringify(currentPresetName)
       });
          
     console.log(currentPresetName);  
     
 }

    // END PRESETS

    function bypass(cb) {
        console.log("byPass : " + cb.checked);

        if (cb.checked) {
            // byPass mode
            inputGain.gain.value = 1;
            byPass.gain.value = 0;
        } else {
            // normal amp running mode
            inputGain.gain.value = 0;
            byPass.gain.value = 1;
        }

        // update buttons states
        //var onOffButton = document.querySelector("#myonoffswitch");
        var led = document.querySelector("#led");

        //onOffButton.checked = cb.checked;
        var onOffSwitch = document.querySelector("#switch1");
        if (cb.checked) {
            onOffSwitch.setValue(0, false);
            led.setValue(1, false);
        } else {
            onOffSwitch.setValue(1, false);
            led.setValue(0, false);
        }
    }

    function bypassEQ(cb) {
        console.log("EQ byPass : " + cb.checked);

        if (cb.checked) {
            // byPass mode
            inputEQ.gain.value = 1;
            bypassEQg.gain.value = 0;
        } else {
            // normal amp running mode
            inputEQ.gain.value = 0;
            bypassEQg.gain.value = 1;
        }

        // update buttons states
        //var onOffButton = document.querySelector("#myonoffswitch");
        var led = document.querySelector("#led");

        //onOffButton.checked = cb.checked;
        var eqOnOffSwitch = document.querySelector("#switch2");
        if (cb.checked) {
            eqOnOffSwitch.setValue(0, false);
        } else {
            eqOnOffSwitch.setValue(1, false);
        }
    }

    // API: methods exposed
    return {
        input: input,
        output: output,
        boostOnOff: boostOnOff,
        eq: eq,
        reverb: reverb,
        cabinet: cabinetSim,
        changeInputGainValue: changeInputGainValue,
        changeOutputGainValue: changeOutputGainValue,
        changeLowCutFreqValue: changeLowCutFreqValue,
        changeHicutFreqValue: changeHicutFreqValue,
        changeBassFilterValue: changeBassFilterValue,
        changeMidFilterValue: changeMidFilterValue,
        changeTrebleFilterValue: changeTrebleFilterValue,
        changePresenceFilterValue: changePresenceFilterValue,
        changeDrive: changeDrive,
        changeDistorsionValues: changeDistorsionValues,
        changeOversampling: changeOversampling,
        changeQValues: changeQValues,
        changeFreqValues: changeFreqValues,
        changeOutputGain: changeOutputGain,
        changeMasterVolume: changeMasterVolume,
        changeReverbGain: changeReverbGain,
        changeRoom: changeRoom,
        changeEQValues: changeEQValues,
        setDefaultPreset: setDefaultPreset,
        getPresets: getPresets,
        sendData: sendData,
        updateData: updateData,
        deleteData: deleteData,
        setPreset: setPreset,
        printCurrentAmpValues: printCurrentAmpValues,
        bypass: bypass,
        bypassEQ: bypassEQ
    };

}

var reverbImpulses = [
    {
        name: "Fender Hot Rod",
        url: "assets/impulses/reverb/cardiod-rear-levelled.wav"
    },
    {
        name: "PCM 90 clean plate",
        url: "assets/impulses/reverb/pcm90cleanplate.wav"
    },
    {
        name: "Scala de Milan",
        url: "assets/impulses/reverb/ScalaMilanOperaHall.wav"
    }
];
var cabinetImpulses = [
    {
        name: "Vintage Marshall 1",
        url: "assets/impulses/cabinet/Block%20Inside.wav"
    },
    {
        name: "Vox Custom Bright 4x12 M930 Axis 1",
        url: "assets/impulses/cabinet/voxCustomBrightM930OnAxis1.wav"
    },
    {
        name: "Fender Champ, axis",
        url: "assets/impulses/cabinet/FenderChampAxisStereo.wav"
    },
    {
        name: "Marshall 1960, axis",
        url: "assets/impulses/cabinet/Marshall1960.wav"
    }
];
// ------- CONVOLVER, used for both reverb and cabinet simulation -------------------
function Convolver(context, impulses, menuId) {
    var convolverNode, convolverGain, directGain;
    // create source and gain node
    var inputGain = context.createGain();
    var outputGain = context.createGain();
    var decodedImpulse;

    var irDefaultURL = "assets/impulses/reverb/cardiod-rear-levelled.wav";
    var ir1 = "assets/impulses/reverb/pcm90cleanplate.wav";
    var ir2 = "assets/impulses/reverb/ScalaMilanOperaHall.wav";

    var menuIRs;
    var IRs = impulses;

    var currentImpulse = IRs[0];
    var defaultImpulseURL = IRs[0].url;

    convolverNode = context.createConvolver();
    convolverNode.buffer = decodedImpulse;

    convolverGain = context.createGain();
    convolverGain.gain.value = 0;

    directGain = context.createGain();
    directGain.gain.value = 1;

    buildIRsMenu(menuId);
    buildAudioGraphConvolver();
    setGain(0.2);
    loadImpulseByUrl(defaultImpulseURL);


    function loadImpulseByUrl(url) {
        // Load default impulse
        const samples = Promise.all([loadSample(context, url)]).then(setImpulse);
    }

    function loadImpulseByName(name) {
        if (name === undefined) {
            name = IRs[0].name;
            console.log("loadImpulseByName: name undefined, loading default impulse " + name);
        }

        var url = "none";
        // get url corresponding to name
        for (var i = 0; i < IRs.length; i++) {
            if (IRs[i].name === name) {
                url = IRs[i].url;
                currentImpulse = IRs[i];
                menuIRs.value = i;
                break;
            }
        }
        if (url === "none") {
            console.log("ERROR loading reverb impulse name = " + name);
        } else {
            console.log("loadImpulseByName loading " + currentImpulse.name);
            loadImpulseByUrl(url);
        }
    }

    function loadImpulseFromMenu() {
        var url = IRs[menuIRs.value].url;
        currentImpulse = IRs[menuIRs.value];
        console.log("loadImpulseFromMenu loading " + currentImpulse.name);
        loadImpulseByUrl(url);
    }

    function setImpulse(param) {
        // we get here only when the impulse is loaded and decoded
        console.log("impulse loaded and decoded");
        convolverNode.buffer = param[0];
        console.log("convolverNode.buffer set with the new impulse (loaded and decoded");
    }

    function buildAudioGraphConvolver() {
        // direct/dry route source -> directGain -> destination
        inputGain.connect(directGain);
        directGain.connect(outputGain);

        // wet route with convolver: source -> convolver 
        // -> convolverGain -> destination
        inputGain.connect(convolverNode);
        convolverNode.connect(convolverGain);
        convolverGain.connect(outputGain);
    }

    function setGain(value) {
        var v1 = Math.cos(value * Math.PI / 2);
        var v2 = Math.cos((1 - value) * Math.PI / 2);

        directGain.gain.value = v1;
        convolverGain.gain.value = v2;
    }

    function getGain() {
        return 2 * Math.acos(directGain.gain.value) / Math.PI;
    }

    function getName() {
        return currentImpulse.name;
    }


    function buildIRsMenu(menuId) {
        menuIRs = document.querySelector("#" + menuId);

        IRs.forEach(function (impulse, index) {
            var option = document.createElement("option");
            option.value = index;
            option.text = impulse.name;
            menuIRs.appendChild(option);
        });

        menuIRs.oninput = loadImpulseFromMenu;
    }
    //--------------------------------------
    // API : exposed methods and properties
    // -------------------------------------
    return {
        input: inputGain,
        output: outputGain,
        setGain: setGain,
        getGain: getGain,
        getName: getName,
        loadImpulseByName: loadImpulseByName
    };
}

// Booster, useful to add a "Boost channel"
var Boost = function (context) {
    // Booster not activated by default
    var activated = false;

    var input = context.createGain();
    var inputGain = context.createGain();
    inputGain.gain.value = 0;
    var byPass = context.createGain();
    byPass.gain.value = 1;
    var filter = context.createBiquadFilter();
    filter.frequency.value = 3317;
    var shaper = context.createWaveShaper();
    shaper.curve = makeDistortionCurve(640);
    var outputGain = context.createGain();
    outputGain.gain.value = 2;
    var output = context.createGain();

    // build graph
    input.connect(inputGain);
    inputGain.connect(shaper);
    shaper.connect(filter);
    filter.connect(outputGain);
    outputGain.connect(output);

    // bypass route
    input.connect(byPass);
    byPass.connect(output);

    function isActivated() {
        return activated;
    }

    function onOff(wantedState) {
        if (wantedState === undefined) {
            // do not boost
            if (activated)
                toggle();
            return;
        }
        var currentState = activated;

        if (wantedState !== currentState) {
            toggle();
        }
    }

    function toggle() {
        if (!activated) {
            byPass.gain.value = 0;
            inputGain.gain.value = 1;
        } else {
            byPass.gain.value = 1;
            inputGain.gain.value = 0;
        }
        activated = !activated;
    }

    function setOversampling(value) {
        shaper.oversample = value;
        console.log("boost set oversampling to " + value);
    }

    function makeDistortionCurve(k) {
        var n_samples = 44100; //65536; //22050;     //44100
        var curve = new Float32Array(n_samples);
        var deg = Math.PI / 180;
        for (var i = 0; i < n_samples; i += 1) {
            var x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    // API
    return {
        input: input,
        output: output,
        onOff: onOff,
        toggle: toggle,
        isActivated: isActivated,
        setOversampling: setOversampling
    };
};

