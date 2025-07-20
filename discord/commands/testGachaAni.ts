import { ref } from 'vue'

/**
 * @name 测试寻访动画
 * @description 测试寻访动画
 */
export default defineSlashCommand(() => {
  // TODO: make the gifs non-looping to discord somehow
  const gif = ref('data/gacha_begin.gif')
  const hide = ref(false)

  return reply
    .button(
      '开包',
      () => {
        void (gif.value = 'data/gacha_open.gif')
        hide.value = true
      },
      { hide },
    )
    .file(gif)
    .send('测试寻访动画')
})
