// LSAT Online Test Environment - Main Application
class LSATTestEnvironment {
    constructor() {
        this.currentSection = 1;
        this.currentQuestion = 1;
        this.sectionOrder = this.generateSectionOrder();
        this.sectionData = null; // Will be initialized after JSON loading
        this.answers = {};
        this.correctAnswers = {};
        this.flaggedQuestions = new Set();
        this.sectionTimers = {};
        this.breakTimer = null;
        this.isHighlighterActive = false;
        this.notes = {};
        this.currentRCPassageIndex = null;
        this.currentRCSectionData = null;
        
        this.initializeEventListeners();
        this.initializeTestData();
    }

    // Initialize test data asynchronously
    async initializeTestData() {
        this.sectionData = await this.createTestData();
        this.showScreen('start-screen');
    }

    // Generate randomized section order
    generateSectionOrder() {
        const sections = ['RC', 'LR1', 'LR2'];
        const shuffled = [...sections].sort(() => Math.random() - 0.5);
        return shuffled;
    }

    // Get total number of questions for RC section (across all passages)
    getRCTotalQuestions(sectionData) {
        return sectionData.passages.reduce((total, passage) => total + passage.questions.length, 0);
    }

    // Get passage and question index for a given question number in RC
    getRCPassageAndQuestion(sectionData, questionNumber) {
        let currentQuestion = 0;
        for (let passageIndex = 0; passageIndex < sectionData.passages.length; passageIndex++) {
            const passage = sectionData.passages[passageIndex];
            for (let questionIndex = 0; questionIndex < passage.questions.length; questionIndex++) {
                currentQuestion++;
                if (currentQuestion === questionNumber) {
        return {
                        passageIndex: passageIndex,
                        questionIndex: questionIndex,
                        passage: passage,
                        question: passage.questions[questionIndex]
                    };
                }
            }
        }
        return null;
    }

    // Convert newlines to HTML line breaks
    convertNewlinesToBreaks(text) {
        return text.replace(/\n/g, '<br>');
    }

    // Load a specific RC passage
    loadRCPassage(passageIndex) {
        if (!this.currentRCSectionData) return;
        
        const passage = this.currentRCSectionData.passages[passageIndex];
        document.getElementById('passage-content').innerHTML = `
            <div class="passage-section">
                <h3>Passage ${passageIndex + 1}: ${passage.title}</h3>
                <div class="passage-text">${this.convertNewlinesToBreaks(passage.content)}</div>
            </div>
        `;
    }

    // Create test data from JSON file
    async createTestData() {
        try {
            const response = await fetch('./in.json');
            if (response.ok) {
                const jsonData = await response.json();
                return jsonData;
            }
        } catch (error) {
            console.warn('Could not load in.json file:', error);
        }
        
        // Fallback to default data if JSON loading fails
        return {
            RC: {
                type: 'Reading Comprehension',
                timeLimit: 35,
                questions: []
            },
            LR1: {
                type: 'Logical Reasoning',
                timeLimit: 35,
                questions: []
            },
            LR2: {
                type: 'Logical Reasoning',
                timeLimit: 35,
                questions: []
            }
        };
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Start screen
        document.getElementById('begin-test-btn').addEventListener('click', () => {
            this.startTest();
        });

        // Navigation buttons
        document.getElementById('prev-btn').addEventListener('click', () => {
            this.previousQuestion();
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.nextQuestion();
        });



        document.getElementById('submit-section-btn').addEventListener('click', () => {
            this.showSubmitModal();
        });

        // Modal buttons
        document.getElementById('cancel-submit').addEventListener('click', () => {
            this.hideSubmitModal();
        });

        document.getElementById('confirm-submit').addEventListener('click', () => {
            this.submitSection();
        });

        document.getElementById('close-notes').addEventListener('click', () => {
            this.hideNotesModal();
        });

        // Tool buttons
        document.getElementById('highlighter-btn').addEventListener('click', () => {
            this.toggleHighlighter();
        });

        document.getElementById('notes-btn').addEventListener('click', () => {
            this.showNotesModal();
        });

        // Break screen
        document.getElementById('resume-test-btn').addEventListener('click', () => {
            // Clear break timer if it's running
            if (this.breakTimer) {
                clearInterval(this.breakTimer);
                this.breakTimer = null;
            }
            this.resumeTest();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Event delegation for flag icon clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.question-flag-icon')) {
                this.toggleFlag();
            }
        });

        // JSON modal functionality
        document.getElementById('json-menu-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.showJsonModal();
        });

        document.getElementById('close-json-modal').addEventListener('click', () => {
            this.hideJsonModal();
        });

        document.getElementById('download-json-btn').addEventListener('click', () => {
            this.downloadJson();
        });

        document.getElementById('upload-json-btn').addEventListener('click', () => {
            document.getElementById('json-file-input').click();
        });

        document.getElementById('json-file-input').addEventListener('change', (e) => {
            this.handleJsonUpload(e);
        });
    }

    // Show a specific screen
    showScreen(screenId) {
        // Hide all screens first
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
            screen.classList.remove('active');
        });
        
        // Show the target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.style.display = 'flex';
            targetScreen.classList.add('active');
        }
    }

    // Start the test
    startTest() {
        // Reset test state
        this.currentSection = 1;
        this.currentQuestion = 1;
        this.answers = {};
        this.correctAnswers = {};
        this.flaggedQuestions = new Set();
        this.notes = {};
        this.currentRCPassageIndex = null;
        this.currentRCSectionData = null;
        
        // Clear any existing timers
        Object.values(this.sectionTimers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        this.sectionTimers = {};
        
        if (this.breakTimer) {
            clearInterval(this.breakTimer);
            this.breakTimer = null;
        }
        
        this.showScreen('test-environment');
        this.loadSection(1);
        this.startSectionTimer();
        this.updateNavigationButtons();
    }

    // Load a specific section
    loadSection(sectionNumber) {
        this.currentSection = sectionNumber;
        this.currentQuestion = 1;
        
        const sectionType = this.sectionOrder[sectionNumber - 1];
        const sectionData = this.sectionData[sectionType];
        
        // Update header
        document.getElementById('section-name').textContent = `Section ${sectionNumber}: ${sectionData.type}`;
        
        // Hide all layouts and clear their content
        document.querySelectorAll('.section-layout').forEach(layout => {
            layout.classList.remove('active');
            layout.style.display = 'none';
        });
        
        // Clear all question and answer content
        const contentElements = [
            'passage-content', 'question-content', 'answer-choices',
            'lr-question-content', 'lr-answer-choices',
            'lg-question-content', 'lg-answer-choices', 'game-content'
        ];
        
        contentElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.innerHTML = '';
            }
        });
        
        // Show appropriate layout
        if (sectionType === 'RC') {
            this.loadRCSection(sectionData);
        } else if (sectionType === 'LR1' || sectionType === 'LR2') {
            this.loadLRSection(sectionData);
        }
        
        this.updateQuestionDisplay();
        this.generateQuestionGrid();
        this.updateNavigationButtons();
    }

    // Load Reading Comprehension section
    loadRCSection(sectionData) {
        const rcLayout = document.getElementById('rc-layout');
        rcLayout.classList.add('active');
        rcLayout.style.display = 'flex';
        
        // Store section data for later use
        this.currentRCSectionData = sectionData;
        
        // Load the first question and its corresponding passage
        const firstPassageData = this.getRCPassageAndQuestion(sectionData, 1);
        if (firstPassageData) {
            this.loadRCPassage(firstPassageData.passageIndex);
            this.loadQuestion(firstPassageData.question, 'rc');
        }
    }

    // Load Logical Reasoning section
    loadLRSection(sectionData) {
        const lrLayout = document.getElementById('lr-layout');
        lrLayout.classList.add('active');
        lrLayout.style.display = 'flex';
        
        // Load the first question content as the prompt
        const question = sectionData.questions[0];
        document.getElementById('lr-question-content').innerHTML = `
            <div class="prompt-content">${this.convertNewlinesToBreaks(question.stimulus)}</div>
        `;
        
        this.loadQuestion(question, 'lr');
    }

    // Load a specific question
    loadQuestion(question, layoutType) {
        const answerChoices = document.getElementById(layoutType === 'rc' ? 'answer-choices' : 'lr-answer-choices');
        
        // Add flag icon if question is flagged
        const answerKey = `${this.currentSection}-${this.currentQuestion}`;
        const isFlagged = this.flaggedQuestions.has(answerKey);
        
        // Store correct answer
        this.correctAnswers[answerKey] = question.correct;
        
        // For RC, we need to update the question content in the right pane
        if (layoutType === 'rc') {
            const questionContent = document.getElementById('question-content');
            questionContent.innerHTML = `
                <div class="question-header">
                    <h4>Question ${this.currentQuestion}</h4>
                </div>
                <div class="question-flag-icon ${isFlagged ? 'flagged' : ''}" data-action="toggle-flag">⚑</div>
                <p>${this.convertNewlinesToBreaks(question.text)}</p>
            `;
        } else if (layoutType === 'lr') {
            // For LR, update the question display in the right pane
            const questionDisplay = document.getElementById('lr-question-display');
            questionDisplay.innerHTML = `
                <div class="question-header">
                    <h4>Question ${this.currentQuestion}</h4>
                </div>
                <div class="question-flag-icon ${isFlagged ? 'flagged' : ''}" data-action="toggle-flag">⚑</div>
                <p>${this.convertNewlinesToBreaks(question.text)}</p>
            `;
        }
        
        answerChoices.innerHTML = '';
        question.choices.forEach((choice, index) => {
            const choiceElement = document.createElement('div');
            choiceElement.className = 'answer-choice';
            choiceElement.innerHTML = `
                <div class="answer-choice-label">${String.fromCharCode(65 + index)}</div>
                <div class="answer-choice-text">${choice}</div>
            `;
            
            // Add separate event listeners for label and text
            const labelElement = choiceElement.querySelector('.answer-choice-label');
            const textElement = choiceElement.querySelector('.answer-choice-text');
            
            // Clicking the letter (label) selects the answer
            labelElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectAnswer(index);
            });
            
            // Clicking the text strikes it through
            textElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleStrikeThrough(choiceElement);
            });
            
            answerChoices.appendChild(choiceElement);
        });
        
        // Restore previous answer if exists
        if (this.answers[answerKey] !== undefined) {
            this.selectAnswer(this.answers[answerKey]);
        }
    }

    // Select an answer
    selectAnswer(choiceIndex) {
        const answerKey = `${this.currentSection}-${this.currentQuestion}`;
        this.answers[answerKey] = choiceIndex;
        
        // Update visual selection
        const answerChoices = document.querySelectorAll('.answer-choice');
        answerChoices.forEach((choice, index) => {
            choice.classList.toggle('selected', index === choiceIndex);
        });
        
        this.updateQuestionGrid();
    }

    // Toggle strikethrough for answer choice text
    toggleStrikeThrough(choiceElement) {
        choiceElement.classList.toggle('struck-through');
    }

    // Navigate to previous question
    previousQuestion() {
        if (this.currentQuestion > 1) {
            this.currentQuestion--;
            this.loadCurrentQuestion();
        }
    }

    // Navigate to next question
    nextQuestion() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const sectionData = this.sectionData[sectionType];
        const maxQuestions = sectionType === 'RC' ? this.getRCTotalQuestions(sectionData) : sectionData.questions.length;
        
        if (this.currentQuestion < maxQuestions) {
            this.currentQuestion++;
            this.loadCurrentQuestion();
        }
    }

    // Load the current question
    loadCurrentQuestion() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const sectionData = this.sectionData[sectionType];
        
        let question;
        if (sectionType === 'RC') {
            const passageData = this.getRCPassageAndQuestion(sectionData, this.currentQuestion);
            if (passageData) {
                // Load the passage if it's different from the current one
                if (!this.currentRCPassageIndex || this.currentRCPassageIndex !== passageData.passageIndex) {
                    this.loadRCPassage(passageData.passageIndex);
                    this.currentRCPassageIndex = passageData.passageIndex;
                }
                question = passageData.question;
            this.loadQuestion(question, 'rc');
            }
        } else if (sectionType === 'LR1' || sectionType === 'LR2') {
            question = sectionData.questions[this.currentQuestion - 1];
            // Update the prompt content for LR
            document.getElementById('lr-question-content').innerHTML = `
                <div class="prompt-content">${this.convertNewlinesToBreaks(question.stimulus)}</div>
            `;
            this.loadQuestion(question, 'lr');
        }
        
        this.updateQuestionDisplay();
        this.updateQuestionGrid();
        this.updateNavigationButtons();
    }

    // Update question counter display
    updateQuestionDisplay() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const sectionData = this.sectionData[sectionType];
        const maxQuestions = sectionType === 'RC' ? this.getRCTotalQuestions(sectionData) : sectionData.questions.length;
        
        document.getElementById('question-counter').textContent = `Question ${this.currentQuestion} of ${maxQuestions}`;
    }

    // Generate question grid
    generateQuestionGrid() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const sectionData = this.sectionData[sectionType];
        const maxQuestions = sectionType === 'RC' ? this.getRCTotalQuestions(sectionData) : sectionData.questions.length;
        
        const grid = document.getElementById('question-grid');
        grid.innerHTML = '';
        
        for (let i = 1; i <= maxQuestions; i++) {
            const questionNumber = document.createElement('div');
            questionNumber.className = 'question-number';
            questionNumber.textContent = i;
            questionNumber.addEventListener('click', () => {
                this.jumpToQuestion(i);
            });
            grid.appendChild(questionNumber);
        }
        
        this.updateQuestionGrid();
    }

    // Update question grid visual state
    updateQuestionGrid() {
        const questionNumbers = document.querySelectorAll('.question-number');
        questionNumbers.forEach((number, index) => {
            const questionNum = index + 1;
            const answerKey = `${this.currentSection}-${questionNum}`;
            
            number.classList.remove('answered', 'flagged', 'current');
            
            // Add flagged class if question is flagged (regardless of other states)
            if (this.flaggedQuestions.has(answerKey)) {
                number.classList.add('flagged');
            }
            
            // Add current class if this is the current question
            if (questionNum === this.currentQuestion) {
                number.classList.add('current');
            } else if (this.answers[answerKey] !== undefined) {
                number.classList.add('answered');
            }
        });
    }

    // Update navigation button states
    updateNavigationButtons() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const sectionData = this.sectionData[sectionType];
        const maxQuestions = sectionType === 'RC' ? this.getRCTotalQuestions(sectionData) : sectionData.questions.length;
        
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        // Disable previous button if on first question
        if (this.currentQuestion === 1) {
            prevBtn.disabled = true;
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.disabled = false;
            prevBtn.classList.remove('disabled');
        }
        
        // Disable next button if on last question
        if (this.currentQuestion === maxQuestions) {
            nextBtn.disabled = true;
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.disabled = false;
            nextBtn.classList.remove('disabled');
        }
    }

    // Jump to a specific question
    jumpToQuestion(questionNumber) {
        this.currentQuestion = questionNumber;
        this.loadCurrentQuestion();
    }

    // Toggle flag for current question
    toggleFlag() {
        const answerKey = `${this.currentSection}-${this.currentQuestion}`;
        if (this.flaggedQuestions.has(answerKey)) {
            this.flaggedQuestions.delete(answerKey);
        } else {
            this.flaggedQuestions.add(answerKey);
        }
        this.updateQuestionGrid();
        this.loadCurrentQuestion(); // Refresh the question display to show/hide flag icon
    }

    // Start section timer
    startSectionTimer() {
        const sectionType = this.sectionOrder[this.currentSection - 1];
        const timeLimit = this.sectionData[sectionType].timeLimit;
        let timeLeft = timeLimit * 60; // Convert to seconds
        
        const timerElement = document.getElementById('timer');
        
        this.sectionTimers[this.currentSection] = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Add warning class when time is running low
            if (timeLeft <= 300) { // 5 minutes
                timerElement.classList.add('warning');
            }
            
            if (timeLeft <= 0) {
                this.submitSection();
            }
            
            timeLeft--;
        }, 1000);
    }

    // Show submit confirmation modal
    showSubmitModal() {
        document.getElementById('submit-modal').classList.add('active');
    }

    // Hide submit confirmation modal
    hideSubmitModal() {
        document.getElementById('submit-modal').classList.remove('active');
    }

    // Show JSON modal
    showJsonModal() {
        document.getElementById('json-modal').classList.add('active');
    }

    // Hide JSON modal
    hideJsonModal() {
        document.getElementById('json-modal').classList.remove('active');
        // Clear file input
        document.getElementById('json-file-input').value = '';
        document.getElementById('selected-file-name').textContent = '';
    }

    // Download JSON file
    downloadJson() {
        const dataStr = JSON.stringify(this.sectionData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'in.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Handle JSON file upload
    handleJsonUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Update selected file name
        document.getElementById('selected-file-name').textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                this.sectionData = jsonData;
                this.hideJsonModal();
                this.showNotification('JSON file uploaded successfully!', 'success');
                
                // Restart the test with new data
                this.startTest();
            } catch (error) {
                this.showNotification('Invalid JSON file. Please check the format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    // Submit current section
    submitSection() {
        // Clear section timer
        if (this.sectionTimers[this.currentSection]) {
            clearInterval(this.sectionTimers[this.currentSection]);
        }
        
        this.hideSubmitModal();
        
        // Check if this was the last section
        if (this.currentSection === 3) {
            this.endTest();
        } else {
            this.loadSection(this.currentSection + 1);
            this.startSectionTimer();
        }
    }

    // End the test
    endTest() {
        this.showScreen('end-screen');
        this.generateTestSummary();
    }

    // Generate test summary
    generateTestSummary() {
        const summaryList = document.getElementById('test-summary-list');
        summaryList.innerHTML = '';
        
        let totalCorrect = 0;
        let totalQuestions = 0;
        
        for (let i = 1; i <= 3; i++) {
            const sectionType = this.sectionOrder[i - 1];
            const sectionData = this.sectionData[sectionType];
            const maxQuestions = sectionType === 'RC' ? sectionData.passages[0].questions.length : sectionData.questions.length;
            
            let answeredCount = 0;
            let correctCount = 0;
            
            // Create section header
            const sectionHeader = document.createElement('li');
            sectionHeader.className = 'section-header';
            sectionHeader.innerHTML = `<h4>Section ${i}: ${sectionData.type}</h4>`;
            summaryList.appendChild(sectionHeader);
            
            // Add question-by-question results
            for (let j = 1; j <= maxQuestions; j++) {
                const answerKey = `${i}-${j}`;
                const userAnswer = this.answers[answerKey];
                const correctAnswer = this.correctAnswers[answerKey];
                
                if (userAnswer !== undefined) {
                    answeredCount++;
                    totalQuestions++;
                    
                    const isCorrect = userAnswer === correctAnswer;
                    if (isCorrect) {
                        correctCount++;
                        totalCorrect++;
                    }
                    
                    const questionItem = document.createElement('li');
                    questionItem.className = `question-result ${isCorrect ? 'correct' : 'incorrect'}`;
                    
                    const userChoice = String.fromCharCode(65 + userAnswer);
                    const correctChoice = String.fromCharCode(65 + correctAnswer);
                    
                    questionItem.innerHTML = `
                        <div class="question-result-content">
                            <span class="question-number">Q${j}</span>
                            <span class="user-answer">Your answer: ${userChoice}</span>
                            <span class="correct-answer">Correct: ${correctChoice}</span>
                            <span class="result-icon">${isCorrect ? '✅' : '❌'}</span>
                        </div>
                    `;
                    
                    summaryList.appendChild(questionItem);
                }
            }
            
            // Add section summary
            const sectionSummary = document.createElement('li');
            sectionSummary.className = 'section-summary';
            sectionSummary.innerHTML = `
                <strong>Section ${i} Summary: ${correctCount}/${answeredCount} correct (${answeredCount > 0 ? Math.round((correctCount/answeredCount)*100) : 0}%)</strong>
            `;
            summaryList.appendChild(sectionSummary);
            
            // Add spacing
            const spacer = document.createElement('li');
            spacer.className = 'result-spacer';
            summaryList.appendChild(spacer);
        }
        
        // Add overall summary
        const overallSummary = document.createElement('li');
        overallSummary.className = 'overall-summary';
        overallSummary.innerHTML = `
            <h3>Overall Results: ${totalCorrect}/${totalQuestions} correct (${totalQuestions > 0 ? Math.round((totalCorrect/totalQuestions)*100) : 0}%)</h3>
        `;
        summaryList.insertBefore(overallSummary, summaryList.firstChild);
    }

    // Toggle highlighter
    toggleHighlighter() {
        this.isHighlighterActive = !this.isHighlighterActive;
        const highlighterBtn = document.getElementById('highlighter-btn');
        highlighterBtn.classList.toggle('active', this.isHighlighterActive);
        
        if (this.isHighlighterActive) {
            document.body.style.cursor = 'crosshair';
            this.enableTextSelection();
        } else {
            document.body.style.cursor = 'default';
            this.disableTextSelection();
        }
    }

    // Enable text selection for highlighting
    enableTextSelection() {
        document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    }

    // Disable text selection
    disableTextSelection() {
        document.removeEventListener('mouseup', this.handleTextSelection.bind(this));
    }

    // Handle text selection for highlighting
    handleTextSelection() {
        if (!this.isHighlighterActive) return;
        
        const selection = window.getSelection();
        if (selection.toString().length > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.className = 'highlight';
            range.surroundContents(span);
            selection.removeAllRanges();
        }
    }

    // Show notes modal
    showNotesModal() {
        const answerKey = `${this.currentSection}-${this.currentQuestion}`;
        const notesTextarea = document.getElementById('notes-textarea');
        notesTextarea.value = this.notes[answerKey] || '';
        
        document.getElementById('notes-modal').classList.add('active');
        notesTextarea.focus();
        
        // Save notes when textarea changes
        notesTextarea.addEventListener('input', () => {
            this.notes[answerKey] = notesTextarea.value;
        });
    }

    // Hide notes modal
    hideNotesModal() {
        document.getElementById('notes-modal').classList.remove('active');
    }

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Only handle shortcuts in test environment
        if (!document.getElementById('test-environment').classList.contains('active')) {
            return;
        }
        
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousQuestion();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextQuestion();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                e.preventDefault();
                this.selectAnswer(parseInt(e.key) - 1);
                break;
            case 'a':
            case 'A':
                e.preventDefault();
                this.selectAnswer(0);
                break;
            case 'b':
            case 'B':
                e.preventDefault();
                this.selectAnswer(1);
                break;
            case 'c':
            case 'C':
                e.preventDefault();
                this.selectAnswer(2);
                break;
            case 'd':
            case 'D':
                e.preventDefault();
                this.selectAnswer(3);
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                this.selectAnswer(4);
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.toggleFlag();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.toggleHighlighter();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.showNotesModal();
                break;
            case 'Escape':
                e.preventDefault();
                this.hideNotesModal();
                this.hideSubmitModal();
                break;
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LSATTestEnvironment();
});
