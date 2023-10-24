var audioCtx;
const playButton = document.querySelector('button');

function getOSC(freq) {
    const osc = audioCtx.createOscillator();
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.start();
    return osc;
}

function getNoise() {
    // https://noisehack.com/generate-noise-web-audio-api/
    var bufferSize = 4096;
    var whiteNoise = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    whiteNoise.onaudioprocess = function(e) {
        var output = e.outputBuffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }
    return whiteNoise;
}

function add(source, num) {
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;
    var constant = audioCtx.createConstantSource();
    constant.start();
    constant.offset.value = num;
    constant.connect(gainNode);
    source.connect(gainNode);
    return gainNode;
}


function mult(sources, num) {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = num;
    for(var i = 0; i < sources.length; i++) { 
        var s = sources[i];
        s.connect(gainNode); 
    }
    return gainNode;
}

function multSources(source1, source2) {
    const gainNode = audioCtx.createGain();
    source1.connect(gainNode.gain);
    source2.connect(gainNode);
    return gainNode;
}

function clip(source, low, high) {
    const waveShaper = new WaveShaperNode(audioCtx, {
        curve: new Float32Array([low, null, high])
    });
    source.connect(waveShaper);
    return waveShaper;
}

function lop(source, cutoff) {
    var lpf = audioCtx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = cutoff;
    source.connect(lpf);
    return lpf;
}

function hip(source, cutoff) {
    var hpf = audioCtx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = cutoff;
    source.connect(hpf);
    return hpf;
}

function windSpeed() {
    const control = getOSC(0.1);
    var plusOne = add(control, 1);
    console.log(typeof(plusOne));
    const multQuarter = mult([plusOne], 0.25);
    const gustSource = gust(multQuarter);
    const squallSource = squall(multQuarter);
    const addEverything = mult([gustSource, squallSource, multQuarter], 1);
    const clipper = clip(addEverything, 0, 1);
    return clipper;
}

function gust (source) {
    // left side
    const noise = getNoise();
    const lpf1 = lop(noise, 0.5);
    const lpf2 = lop(lpf1, 0.5);
    const hpf = hip(lpf2, 0);
    const multFifty = mult([hpf], 50);
    
    // right side
    const plusHalf = add(source, 0.5);
    const squared = multSources(plusHalf, plusHalf);
    const minusEighth = add(squared, -0.125);

    // combine
    const combineSides = multSources(minusEighth, multFifty);
    return combineSides;
}

function squall (source) {
    // left side 
    // apply max(signal, 0.5)
    const waveShaper = new WaveShaperNode(audioCtx, {
        curve: new Float32Array([0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, null, null, null])
    });
    source.connect(waveShaper);
    const minusPointFour = add(waveShaper, -0.4);
    const multPointEight = mult([minusPointFour], 0.8);
    const squared = multSources(multPointEight, multPointEight);


    // right side
    const noise = getNoise();
    const lpf1 = lop(noise, 3);
    const lpf2 = lop(lpf1, 3);
    const hpf = hip(lpf2, 0);
    const multTwenty = mult([hpf], 20);

    // combine
    const combineSides = multSources(squared, multTwenty);
    return combineSides;

}

function panner(source, val) {
    const panNode = audioCtx.createStereoPanner();
    panNode.pan.value = val;
    source.connect(panNode);
    return panNode;
}

function whistle(source) {
    //left
    const noise = getNoise();

    //middle 
    const addPointTwelve = add(source, 0.12);
    const square = multSources(addPointTwelve, addPointTwelve);

    // right
    const multFourHundo = mult([source], 400);
    const addSixHundo = add(multFourHundo, 600);

    // combine left and right 
    const vcf = audioCtx.createBiquadFilter();
    vcf.type = "bandpass";
    //vcf.frequency.value = 1000;
    vcf.Q.value = 60;
    noise.connect(vcf);
    addSixHundo.connect(vcf.frequency);


    // combine all
    const combine = multSources(square, vcf);
    const multOnePointTwo = mult([combine], 1.2);
    const pan = panner(multOnePointTwo, 0.28);
    return pan;

}

function windNoise(source) {
    //left side 
    const addPointTwo = add(source, 0.2);

    // right side
    const noise = getNoise();
    //apply bandpass
    var bpf = audioCtx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 800;
    bpf.Q.value = 1;
    noise.connect(bpf); 

    // combine 
    const combined = multSources(addPointTwo, bpf);
    const multPointThree = mult([combined], 0.5);
    
    return multPointThree;

}



function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)

    // global gain
    const globalGain = audioCtx.createGain();
    globalGain.gain.value = 1;
    globalGain.connect(audioCtx.destination);
    const windSpeedNode = windSpeed();
    const windSource = windNoise(windSpeedNode);
    windSource.connect(globalGain);

    const whistle1 = whistle(windSpeedNode);
    whistle1.connect(globalGain);

}

playButton.addEventListener('click', function () {

    if (!audioCtx) {
        initAudio();
        return;
    }
    else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    else if (audioCtx.state === 'running') {
        audioCtx.suspend();
    }

}, false);