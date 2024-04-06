// Global scope variables
let resizeHandled = false,
  autoplayTimer = null,
  startTime = 0,
  isRunning = true
const debounce =
    (fn, t = 300, e = false, id = 0) =>
    (...a) => (
      id && clearTimeout(id), e && fn.apply(this, a), (id = setTimeout(() => (!e && fn.apply(this, a), (id = null)), t))
    ),
  get = (s, n, c = document.body) => (n ? c.querySelector(s) : c.querySelectorAll(s)),
  // Members list fn's
  getGap = (gaps, gap = {}) =>
    (gap = gaps.media.find(({ query }) => window.matchMedia(query).matches)) ? gap.value : gaps.default,
  // Get visible items
  getVIC = (containerW, itemW, gap) => Math.floor(Math.max((containerW + gap) / (itemW + gap), 1) + 0.02),
  // InitialOffset
  getOffset = (itemW, gap, vio) => -((itemW + gap) * Math.max(...vio)),
  // Static configs
  cfg = {
    animatedAttr: "animated",
    instantAttr: "instant-transform",
    membersAutoplay: true,
    membersCount: 6,
    membersGaps: { default: 20, media: [{ query: "(max-width: 375px)", value: 32 }] },
    membersInstantCssVar: "--offset",
    membersVIO: [1, 2, 3],
    stagesCurrAttr: "data-current",
    stagesInstantCssVar: "--translate-x",
    stagesSlides: 5,
  },
  // Elements
  el = {
    animated: get(`[${cfg.animatedAttr}]`, 0),
    membersContainer: get(".members__container", 1),
    membersList: get(".members__list", 1),
    membersListItems: get(".members__list-item", 0),
    membersControls: get(".members__controls", 1),
    membersVIC: get(".members__controls-counter_vic", 1),
    membersPrevBtn: get(".members__controls-btn_prev", 1),
    membersNextBtn: get(".members__controls-btn_next", 1),
    membersTimer: get(".timer", 1),
    stagesContainer: get(".stages__list-container", 1),
    stagesList: get(".stages__list", 1),
    stagesDots: get(".stages__carousel-dot", 0),
    stagesPrevBtn: get(".stages__carousel-btn_prev", 1),
    stagesNextBtn: get(".stages__carousel-btn_next", 1),
  },
  /**
   * Get initial elements info: widths, offset, gap, visible items, total slides
   * @return {{sContainerW: number, sOffset:number, mItemW:number, mGap:number, mVICV:number, mTotalSlides:number, mInitOffset:number}}
   */
  getInfo = (el, cfg) => {
    return {
      sContainerW: el.stagesContainer.clientWidth,
      sOffset: window.matchMedia("(max-width: 849px)").matches
        ? stagesState.currentIndex * (el.stagesContainer.clientWidth + 20) * -1
        : 0,
      mItemW: el.membersListItems[0].offsetWidth,
      mGap: getGap(cfg.membersGaps),
      mVICV: getVIC(el.membersContainer.offsetWidth, el.membersListItems[0].offsetWidth, getGap(cfg.membersGaps)),
      mTotalSlides:
        cfg.membersCount /
        getVIC(el.membersContainer.offsetWidth, el.membersListItems[0].offsetWidth, getGap(cfg.membersGaps)),
      mInitOffset: getOffset(el.membersListItems[0].offsetWidth, getGap(cfg.membersGaps), cfg.membersVIO),
    }
  },
  // Applying  config's
  instantAttr = cfg.instantAttr,
  membersAutoplay = cfg.membersAutoplay,
  membersCount = cfg.membersCount,
  membersVIO = cfg.membersVIO,
  membersInstant = cfg.membersInstantCssVar,
  stagesInstant = cfg.stagesInstantCssVar,
  stagesCurrAttr = cfg.stagesCurrAttr,
  stagesTotalSlides = cfg.stagesSlides,
  // Declaring elements
  animated = el.animated,
  membersContainer = el.membersContainer,
  membersControls = el.membersControls,
  membersItem = el.membersListItems[0],
  membersList = el.membersList,
  membersNextBtn = el.membersNextBtn,
  membersPrevBtn = el.membersPrevBtn,
  membersVIC = el.membersVIC,
  membersTimer = el.membersTimer,
  stagesContainer = el.stagesContainer,
  stagesDots = el.stagesDots,
  stagesList = el.stagesList,
  stagesNextBtn = el.stagesNextBtn,
  stagesPrevBtn = el.stagesPrevBtn,
  // Utils
  enableInstantTransform = el =>
    (!el.hasAttribute(instantAttr) || el.getAttribute(instantAttr) === "false") && el.setAttribute(instantAttr, "true"),
  disableInstantTransform = el =>
    el.hasAttribute(instantAttr) && el.getAttribute(instantAttr) === "true" && el.setAttribute(instantAttr, "false"),
  debouncedDisableInstantTransform = e => debounce(disableInstantTransform(e), 300),
  membersObserver = new IntersectionObserver(el =>
    el.forEach(i => syncAutoplay(i.isIntersecting && membersAutoplay ? "default" : "pause"))
  ),
  animatedObserver = new IntersectionObserver(el =>
    el.forEach(i => i.target.setAttribute("paused", `${!i.isIntersecting}`))
  ),
  addEventListeners = () => {
    stagesPrevBtn.onclick = () => moveStages(-1, null)
    stagesNextBtn.onclick = () => moveStages(1, null)
    stagesDots.forEach(
      el =>
        (el.onclick = i => {
          moveStages(null, Array.from(stagesDots).indexOf(i.target))
        })
    )
    membersPrevBtn.onclick = () => moveMembers(1)
    membersNextBtn.onclick = () => moveMembers(-1)
    membersControls.onmouseenter = () => syncAutoplay("pause")
    membersControls.onmouseleave = () => syncAutoplay("default")
    membersList.ontransitionend = () => handleSwap()
    membersObserver.observe(membersContainer)
    animated.forEach(el => {
      el.onmouseenter = () => el.setAttribute("paused", "true")
      el.onmouseleave = () => el.setAttribute("paused", "false")
      animatedObserver.observe(el)
    })
    window.onresize = () => handleResize()
  },
  // State
  membersState = {
    autoplayEnabled: membersAutoplay,
    currentIndex: 0,
    isSwap: false, // flag to swap slides from duplicates to corresponding originals after event "transitionend"
    dir: null, // swap direction
    warp: 0, // handled swapping slides
    itemW: 0,
    offset: 0,
    initOffset: 0,
    totalSlides: 0,
    vic: 0,
    gap: 20,
  },
  stagesState = { currentIndex: 0, offset: 0, containerW: 0 },
  init = () => {
    document.documentElement.removeAttribute("class")
    addEventListeners()
    const info = getInfo(el, cfg),
      newMembersState = {
        itemW: info.mItemW,
        initOffset: info.mInitOffset,
        offset: info.mInitOffset,
        totalSlides: info.mTotalSlides,
        vic: info.mVICV, // Members Visible Items Count Value
        gap: info.mGap,
      },
      newStagesState = {
        containerW: info.sContainerW,
      }
    Object.assign(membersState, newMembersState)
    Object.assign(stagesState, newStagesState)
    membersVIC.textContent = info.mVICV
    enableInstantTransform(membersList)
    membersList.style.setProperty(membersInstant, info.mInitOffset + "px")
    debouncedDisableInstantTransform(membersList)
  },
  moveStages = (dir, index) => {
    const { currentIndex, containerW } = stagesState,
      newIndex = dir !== null ? currentIndex + dir : index,
      newOffset = newIndex * (containerW + 20) * -1
    stagesList.style.setProperty(stagesInstant, newOffset + "px")
    stagesPrevBtn.disabled = newIndex === 0
    stagesNextBtn.disabled = newIndex === stagesTotalSlides - 1
    stagesDots[currentIndex].removeAttribute(stagesCurrAttr)
    stagesDots[newIndex].setAttribute(stagesCurrAttr, true)
    stagesState.currentIndex = newIndex
    stagesState.offset = newOffset
  },
  moveMembers = dir => {
    disableMembersBtns()
    const { currentIndex, totalSlides, gap, vic, offset, itemW } = membersState,
      stepW = (itemW + gap) * vic,
      newOffset = dir === -1 ? offset - stepW : offset + stepW,
      newIndex = dir === -1 ? currentIndex + 1 : currentIndex - 1,
      visibleItemsCounter = (newIndex + 1) * vic,
      state = {
        currentIndex: newIndex,
        offset: newOffset,
        dir: dir,
        isSwap: dir === -1 ? newIndex === totalSlides : currentIndex === 0,
      }
    Object.assign(membersState, state)
    membersVIC.textContent =
      dir === -1 ? (state.isSwap ? vic : visibleItemsCounter) : state.isSwap ? membersCount : visibleItemsCounter
    membersList.style.setProperty(membersInstant, newOffset + "px")
  },
  // Members carousel
  handleSwap = () => {
    const { dir, vic, initOffset, isSwap, totalSlides, itemW, gap, warp } = membersState
    isSwap &&
      !warp &&
      ((membersVIC.textContent = dir === -1 ? vic : membersCount),
      (membersState.currentIndex = dir === -1 ? 0 : totalSlides - 1),
      (membersState.offset = dir === -1 ? initOffset : initOffset + (itemW + gap) * vic * (totalSlides - 1) * -1),
      warpSwap()),
      !warp && enableMembersBtns()
  },
  warpSwap = () => {
    membersState.warp = 1
    enableInstantTransform(membersList)
    membersList.style.setProperty(membersInstant, membersState.offset + "px")
    deactivateWarp()
  },
  deactivateWarp = debounce(() => {
    membersState.isSwap = false
    membersState.dir = null
    membersState.warp = 0
    disableInstantTransform(membersList)
    enableMembersBtns()
  }, 10),
  enableMembersBtns = () => {
    membersPrevBtn.disabled = false
    membersNextBtn.disabled = false
  },
  disableMembersBtns = () => {
    membersPrevBtn.disabled = true
    membersNextBtn.disabled = true
  },
  syncAutoplay = state => {
    if (membersAutoplay) {
      autoplayTimer && clearTimeout(autoplayTimer)
      membersState.autoplayEnabled = state === "pause" ? !1 : !0
      if (membersState.autoplayEnabled) {
        startTimer()
        autoplayTimer = setInterval(() => {
          membersNextBtn.click()
          startTimer()
        }, 4000)
        membersControls.classList.add("members__controls--running")
        membersControls.classList.remove("members__controls--paused")
      } else {
        stopTimer()
        membersControls.classList.add("members__controls--paused")
        membersControls.classList.remove("members__controls--running")
      }
    }
  },
  handleResize = () => {
    if (resizeHandled) return
    syncAutoplay("pause")
    enableInstantTransform(membersList)
    enableInstantTransform(stagesList)
    debouncedResizeChanges()
    resizeHandled = true
  },
  debouncedResizeChanges = debounce(() => {
    const info = getInfo(el, cfg),
      newStagesState = {
        containerW: info.sContainerW,
        offset: info.sOffset,
      },
      newMembersState = {
        itemW: info.mItemW,
        gap: info.mGap,
        vic: info.mVICV,
        totalSlides: info.mTotalSlides,
        initOffset: info.mInitOffset,
        currentIndex: 0,
        offset: info.mInitOffset,
      }
    Object.assign(stagesState, newStagesState)
    Object.assign(membersState, newMembersState)
    stagesList.style.setProperty(stagesInstant, info.sOffset + "px")
    disableInstantTransform(stagesList)
    membersVIC.textContent = info.mVICV
    membersList.style.setProperty(membersInstant, info.mInitOffset + "px")
    disableInstantTransform(membersList)
    resizeHandled = false
    syncAutoplay("default")
  }, 250),
  // Members progress timer
  now = () => performance.now(),
  update = () => {
    if (!isRunning) return
    const delta = now() - startTime,
      difference = 4e3 - delta,
      percent = Math.max(0, Math.min(100, (difference / 4e3) * 100))
    membersTimer.style.setProperty("--progress", percent)
    difference > 0 && requestAnimationFrame(update)
  },
  startTimer = () => {
    startTime = now()
    isRunning = !0
    membersTimer.style.setProperty("--visibility", "visible")
    requestAnimationFrame(update)
  },
  stopTimer = () => {
    isRunning = !1
    membersTimer.style.setProperty("--visibility", "hidden")
    cancelAnimationFrame(update)
  }
document.addEventListener("DOMContentLoaded", () => {
  init()
})
