import _ from 'lodash';
import { assert } from 'chai';
import { stub } from 'sinon';
import Shepherd from '../../src/js/shepherd.js';
import { Step } from '../../src/js/step.js';
import tippy from 'tippy.js';
import { defaults as tooltipDefaults } from '../../src/js/utils/tooltip-defaults';
import { spy } from 'sinon';

// since importing non UMD, needs assignment
window.Shepherd = Shepherd;

const DEFAULT_STEP_CLASS = 'shepherd-step-tooltip';

describe('Tour | Top-Level Class', function() {
  let instance, shouldShowStep;

  const defaultStepOptions = {
    classes: DEFAULT_STEP_CLASS,
    scrollTo: true
  };

  beforeEach(() => {
    tippy.disableAnimations();
  });

  afterEach(() => {
    instance.complete();
  });

  describe('constructor', function() {
    it('creates a new tour instance', function() {
      instance = new Shepherd.Tour({ defaultStepOptions });

      assert.equal(instance instanceof Shepherd.Tour, true);
    });

    it('returns the default options on the instance', function() {
      instance = new Shepherd.Tour({ defaultStepOptions });

      assert.deepEqual(instance.options.defaultStepOptions, {
        classes: DEFAULT_STEP_CLASS,
        scrollTo: true
      });
    });

    it('sets the correct bindings', function() {
      instance = new Shepherd.Tour({ defaultStepOptions });

      const bindings = Object.keys(instance.bindings);
      const tourEvents = ['complete', 'cancel', 'start', 'show', 'active', 'inactive'];
      // Check that all bindings are included
      const difference = _.difference(tourEvents, bindings);
      assert.equal(difference.length, 0, 'all tour events bound');
    });

    it('sets defaults for tippy', function() {
      const tourSpy = spy(Shepherd.Tour.prototype, '_setTooltipDefaults');
      const tippySpy = spy(tippy, 'setDefaults');

      assert.equal(tourSpy.callCount, 0);
      assert.equal(tippySpy.callCount, 0);

      instance = new Shepherd.Tour({ defaultStepOptions });

      assert.equal(tourSpy.callCount, 1);
      assert.equal(tippySpy.callCount, 1);
      assert.equal(tippySpy.calledWith(tooltipDefaults), true);
    });

    it('generates a unique `id` property, optionally based upon the `tourName` option', function() {
      const instance1 = new Shepherd.Tour();
      const instance2 = new Shepherd.Tour({ tourName: 'select-avatar'});

      assert.equal(instance1.id.startsWith('tour--'), true);
      assert.equal(instance2.id.startsWith('select-avatar--'), true);

      const uniqueId1 = instance1.id.split('--')[1];
      const uniqueId2 = instance2.id.split('--')[1];

      assert.notEqual(uniqueId1, uniqueId2);
    });
  });

  describe('methods', () => {
    beforeEach(() => {
      shouldShowStep = false;

      instance = new Shepherd.Tour({
        defaultStepOptions
      });

      instance.addStep('test', {
        id: 'test',
        title: 'This is a test step for our tour'
      });

      instance.addStep('skipped-step', {
        classes: 'skipped',
        id: 'skipped-step',
        title: 'This step should be skipped',
        showOn() {
          return shouldShowStep;
        }
      });

      instance.addStep('test2', {
        id: 'test2',
        title: 'Another Step'
      });

      instance.addStep('test3', {
        id: 'test3',
        title: 'Yet, another test step'
      });
    });

    describe('.addStep()', function() {
      it('adds tour steps', function() {
        assert.equal(instance.steps.length, 4);
        assert.equal(instance.getById('test').options.classes, DEFAULT_STEP_CLASS, 'classes passed to step options');
      });

      it('adds steps with only one arg', function() {
        const step = instance.addStep({
          id: 'one-arg'
        });

        assert.equal(instance.steps.length, 5);
        assert.equal(step.id, 'one-arg', 'id applied to step with just one arg');
      });

      it('adds steps that are already Step instances', function() {
        const step = instance.addStep(new Step(instance, {
          id: 'already-a-step'
        }));

        assert.equal(instance.steps.length, 5);
        assert.equal(step.id, 'already-a-step', 'id applied to step instance');
        assert.equal(step.tour, instance, 'tour is set to `this`');
      });
    });

    describe('.getById()', function() {
      it('returns the step by ID with the right title', function() {
        assert.equal(instance.steps.length, 4);
        assert.equal(instance.getById('test3').options.title, 'Yet, another test step');
      });

    });

    describe('.start()', function() {
      it('starts a tour that is the current active', function() {
        instance.start();

        assert.equal(instance, Shepherd.activeTour);
      });

      it('adds the current tour\'s "id" property to the body as a data attribute', function() {
        instance.id = 'test-id';
        instance.start();

        assert.equal(document.body.hasAttribute('data-shepherd-active-tour'), true);
        assert.equal(document.body.getAttribute('data-shepherd-active-tour'), 'test-id');
      });
    });

    describe('.getCurrentStep()', function() {
      it('returns the currently shown step', function() {
        instance.start();
        assert.equal(instance.getCurrentStep().id, 'test');
      });
    });

    describe('.hide()', function() {
      it('hides the current step', () => {
        const firstStep = instance.steps[0];
        const hideStepSpy = spy(firstStep, 'hide');

        assert.equal(firstStep.isOpen(), false);

        instance.start();

        assert.equal(firstStep.isOpen(), true);

        instance.hide();

        assert.equal(firstStep.isOpen(), false);
        assert.equal(hideStepSpy.callCount, 1);
      });
    });

    describe('isActive', function() {
      it('computes whether or not `Shepherd.activeTour` equals the instance', function() {
        Shepherd.activeTour = '';
        assert.equal(instance.isActive(), false);

        Shepherd.activeTour = instance;
        assert.equal(instance.isActive(), true);

        Shepherd.activeTour = '';
        assert.equal(instance.isActive(), false);
      });
    });

    describe('.next()/.back()', function() {
      it('goes to the next/previous steps', function() {
        instance.start();
        instance.next();
        assert.equal(instance.getCurrentStep().id, 'test2');
        instance.back();
        assert.equal(instance.getCurrentStep().id, 'test');
      });

      it('next completes tour when on last step', function() {
        let completeFired = false;
        instance.on('complete', () => {
          completeFired = true;
        });

        instance.start();
        instance.show('test3');
        assert.equal(instance.getCurrentStep().id, 'test3');
        instance.next();
        assert.isOk(completeFired, 'complete is called when next is clicked on last step');
      });
    });

    describe('.cancel()', function() {
      it('shows confirm dialog when confirmCancel is true', function() {
        instance = new Shepherd.Tour({
          defaultStepOptions,
          confirmCancel: true,
          confirmCancelMessage: 'Confirm cancel?'
        });

        instance.addStep('test', {
          id: 'test',
          title: 'This is a test step for our tour'
        });

        let inactiveFired = false;
        instance.on('inactive', () => {
          inactiveFired = true;
        });

        const windowConfirmStub = stub(window, 'confirm');
        windowConfirmStub.returns(false);

        instance.start();
        assert.equal(instance, Shepherd.activeTour, 'activeTour is set to our tour');
        instance.cancel();
        assert.isOk(windowConfirmStub.called, 'window confirm is called');
        assert.isNotOk(inactiveFired, 'tour still going, since confirm returned false');

        windowConfirmStub.returns(true);
        instance.cancel();
        assert.isOk(windowConfirmStub.called, 'window confirm is called');
        assert.isOk(inactiveFired, 'tour inactive, since confirm returned true');
      });

      it('tears down tour on cancel', function() {
        let inactiveFired = false;
        instance.on('inactive', () => {
          inactiveFired = true;
        });
        instance.start();
        assert.equal(instance, Shepherd.activeTour, 'activeTour is set to our tour');
        instance.cancel();
        assert.isNotOk(Shepherd.activeTour, 'activeTour is torn down');
        assert.isOk(inactiveFired, 'inactive event fired');
      });

      it('triggers cancel event when cancel function is called', function() {
        let cancelFired = false;
        instance.on('cancel', () => {
          cancelFired = true;
        });

        instance.start();
        instance.cancel();
        assert.isOk(cancelFired, 'cancel event fired');
      });
    });

    describe('.complete()', function() {
      it('triggers complete event when complete function is called', function() {
        let completeFired = false;

        instance.on('complete', () => {
          completeFired = true;
        });

        instance.start();
        instance.complete();
        assert.isOk(completeFired, 'complete event fired');
      });

      it('calls `done()`', () => {
        const doneSpy = spy(instance, 'done');

        assert.equal(doneSpy.callCount, 0);

        instance.start();
        instance.complete();

        assert.equal(doneSpy.callCount, 1);
      });
    });

    describe('.done()', function() {
      it('tears down the active tour', function() {
        instance.start();

        assert.equal(instance, Shepherd.activeTour, 'activeTour is set to our tour');

        instance.complete();

        assert.equal(Shepherd.activeTour, null, '`activeTour` is torn down and removed from the `Shepherd` global');
      });


      it('removes any of its `Step` tooltip elements from the DOM', function() {
        const testStep = {
          id: 'element-removal-test',
          classes: 'element-removal-test',
          title: 'This is a test step for our tour'
        };

        instance.addStep(testStep);
        instance.start();
        instance.show('element-removal-test');

        assert.exists(document.querySelector(`.element-removal-test`), 'a step is rendered in the DOM after the tour starts');

        instance.complete();

        assert.notExists(document.querySelector(`.element-removal-test`), 'steps are removed from the DOM after the tour completes');
      });


      it('fires the `inactive` event', function() {
        let inactiveFired = false;

        instance.on('inactive', () => {
          inactiveFired = true;
        });

        instance.start();

        assert.equal(inactiveFired, false, 'inactive event does not fire before `complete()`');

        instance.complete();

        assert.equal(inactiveFired, true, 'inactive event fires after `complete()`');
      });
    });

    describe('.removeStep()', function() {
      it('removes the step when passed the id', function() {
        instance.start();
        assert.equal(instance.steps.length, 4);
        instance.removeStep('test2');
        assert.equal(instance.steps.length, 3);
      });

      it('hides the step before removing', function() {
        let hideFired = false;
        instance.start();
        assert.equal(instance.steps.length, 4);
        const step = instance.getById('test');
        step.on('hide', () => {
          hideFired = true;
        });
        instance.removeStep('test');
        assert.equal(instance.steps.length, 3);
        assert.isOk(hideFired, 'hide is fired before step is destroyed');
      });
    });

    describe('.show()', function() {
      it('show short-circuits if next is not found', function() {
        let showFired = false;
        instance.start();
        instance.on('show', () => {
          showFired = true;
        });
        instance.show('not-a-real-key');
        assert.isNotOk(showFired, 'showFired is false because show short circuits');
      });

      it('showOn determines which steps to skip', function() {
        instance.start();
        assert.equal(instance.getCurrentStep().id, 'test');
        instance.next();
        assert.equal(instance.getCurrentStep().id, 'test2');
        assert.notEqual(instance.getCurrentStep().id, 'skipped-step', 'step skipped because `showOn` returns false');
        instance.back();
        shouldShowStep = true;
        instance.next();
        assert.equal(instance.getCurrentStep().id, 'skipped-step', 'step shown because `showOn` returns true');
      });

      it(`sets the instance on \`Shepherd.activeTour\` if it's not already set`, function() {
        const setupFuncSpy = spy(instance, '_setupActiveTour');
        Shepherd.activeTour = null;

        assert.equal(setupFuncSpy.callCount, 0);

        instance.start();

        assert.equal(setupFuncSpy.callCount, 1);
        assert.equal(Shepherd.activeTour, instance);
      });
    });
  });
});
